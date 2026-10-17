"""Train gesture classifiers from collected samples and export them for the browser.
Usage: python train.py [data/samples.jsonl]   (needs: pip install numpy scikit-learn)"""
import json, sys, os
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix

def feat(hands, slots):
    hh = sorted(hands, key=lambda h: h[0][0])[:slots]; out = []
    for i in range(slots):
        if i >= len(hh): out += [0.0] * 64; continue
        h = np.array(hh[i], dtype=float); p = h - h[0]
        s = np.max(np.hypot(p[:, 0], p[:, 1])) or 1.0
        out += list((p / s).ravel()) + [1.0]
    return out

def fit(rows, slots):
    X = np.array([feat(r['hands'], slots) for r in rows]); y = np.array([str(r['label']) for r in rows])
    mean = X.mean(0); std = X.std(0); std[std < 1e-6] = 1.0
    Z = (X - mean) / std
    clf = MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=600, random_state=0)
    return clf, Z, y, mean, std

def export(clf, mean, std, path):
    layers = [{'W': np.round(W, 5).tolist(), 'b': np.round(b, 5).tolist()} for W, b in zip(clf.coefs_, clf.intercepts_)]
    json.dump({'classes': list(clf.classes_), 'mean': np.round(mean, 5).tolist(), 'std': np.round(std, 5).tolist(), 'layers': layers}, open(path, 'w'))

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'data/samples.jsonl'
    rows = [json.loads(l) for l in open(src) if l.strip()]
    for game, slots in (('rps', 1), ('cricket', 2)):
        R = [r for r in rows if r['game'] == game and r.get('label') is not None and r.get('hands')]
        labels = sorted({str(r['label']) for r in R})
        print(f'\n{game}: {len(R)} labelled samples, classes: {labels}')
        if len(labels) < 3 or len(R) < 30:
            print('  not enough data yet (need 3+ classes and about 30+ samples, ideally 100+ per class)'); continue
        clf, Z, y, mean, std = fit(R, slots)
        try: Ztr, Zte, ytr, yte = train_test_split(Z, y, test_size=.2, stratify=y, random_state=0)
        except ValueError: Ztr, Zte, ytr, yte = train_test_split(Z, y, test_size=.2, random_state=0)
        clf.fit(Ztr, ytr); pred = clf.predict(Zte)
        print(f'  held-out accuracy: {accuracy_score(yte, pred):.1%}'); print(confusion_matrix(yte, pred, labels=clf.classes_))
        clf.fit(Z, y)
        out = os.path.join('public', f'model_{game}.json'); export(clf, mean, std, out); print('  wrote', out)

if __name__ == '__main__': main()

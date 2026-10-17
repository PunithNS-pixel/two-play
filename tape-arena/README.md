# Tape Arena

Run locally: `npm install && npm start`, then open http://localhost:8000 (admin page: http://localhost:8000/admin).

## Make it live (HTTPS, needed for cameras)
1. Push this folder to a GitHub repo.
2. On render.com choose New > Blueprint, pick the repo. It reads render.yaml and builds the Dockerfile.
3. In the Render dashboard, copy the generated ADMIN_KEY. Debug page: https://YOUR-APP.onrender.com/admin?key=ADMIN_KEY
4. Share the site link. One player creates a room, the other joins with the code.
Free hosts have temporary disks and sleep when idle: download samples from /api/export?key=... often.

## Relay for strict networks
If video fails between two friends, add a TURN service (for example a free Metered.ca account) and set TURN_URL, TURN_USER, TURN_PASS on the server.

## Train the model
1. Play rounds and tap Yes or the right move after each one, and use Record 20 samples for quick data.
2. Download samples.jsonl (admin page), put it in data/, then: `pip install numpy scikit-learn && python train.py`
3. It writes public/model_rps.json and public/model_cricket.json. Redeploy and the game uses them automatically.

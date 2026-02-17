# Apify actor with Playwright + Chrome for AliExpress region availability crawler
FROM apify/actor-node-playwright-chrome:20

COPY package*.json ./
RUN npm --quiet set progress=false && npm install --only=prod --no-optional

COPY . ./

# Start the actor (Apify injects input and expects default dataset)
CMD npm start

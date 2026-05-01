# Docker Build
```
sudo docker build -t saashup/curioo-tiles .
```

# Docker Run
```
docker run -p 3000:3000 -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter saashup/curioo-tiles:latest
```

# npm run
```
npm run dev
```
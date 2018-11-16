# seasonal_pathways
applying seasonal tags to Ottawa pathways

## build.sh
- Pull OSM pathways data from overpass
- Compare to city snow plow data, find pathways that lie along city plow routes, generate JSON with such pathways
- Generate OSM file with `seasonal=no` tags for those pathways

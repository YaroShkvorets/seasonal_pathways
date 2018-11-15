const reader = require('geojson-writer').reader
const writer = require('geojson-writer').writer
const turf = require('@turf/turf')
const ruler = require('cheap-ruler')(45.41, 'meters')
const rbush = require('geojson-rbush')

const plowTracksTree = rbush()

const pathwaysWithPlowTracks = [];
const pathwaysWithNoPlowTracks = [];
const pathwaysToSplit = [];
const pathwaysTooShort = [];

const inCityDataPath = "data/city_plow_tracks.json"                     //data from city
const inOsmPathwaysPath = "data/osm_pathways.json"                      //all ways tagged as footway/path/cycleway from overpass
const outPathwaysWithPlowTracksPath = "data/generated_pathways_with_plow_tracks.json"         //generated json of pathways that are supposed to be plowed
const outPathwaysToSplitPath = "data/generated_pathways_to_split.json"
const outPathwaysTooShortPath = "data/generated_pathways_too_short.json"

const kOffsetFromPathwayEnd = 3      //disregard kPathwayTestStep meters from pathway end
const kPathwayTestStep = 3        //we test every pathways every kPathwayTestStep meters
const kPointDistanceNearby = 8    //if there is a plowed track within kPointDistanceNearby meters - point is plowed
const kPointsPlowedThreshold = 0.80 //kPointsPlowedThreshold of pathway points have plowed track nearby -> pathway is plowed
const kTooShortThreshold = 10       //don't take into account pathways that are shorter than kTooShortThreshold meters

console.time('Time')
console.log('Loading plow tracks ...')
let plowTracks = reader(inCityDataPath)
plowTracks.features = plowTracks.features.filter(track => (track.geometry.type=='LineString' || track.geometry.type=='MultiLineString'));
plowTracksTree.load(plowTracks)

console.log('Loading pathways ...')

let pathways = reader(inOsmPathwaysPath).features.filter(pathway => pathway.geometry.type=='LineString' &&
  (pathway.properties.highway == "cycleway" ||
  pathway.properties.highway == "path" ||
  pathway.properties.highway == "footway" ));

console.log(`Loaded ${plowTracks.features.length} plow tracks and ${pathways.length} pathways`);

for (let pathway of pathways) {
  const pathwayLen = ruler.lineDistance(pathway.geometry.coordinates)
  let offset = kOffsetFromPathwayEnd;
  let foundPlowTrack=false
  let pointsTotal=0;
  let pointsWithPlowTracks=0;
  let pointsWithNoPlowTracks=0;
  const bbox = turf.bbox(pathway)
  bbox[0]-=0.001    //expand bbox by 0.001 ~ 100m
  bbox[1]-=0.001
  bbox[2]+=0.001
  bbox[3]+=0.001

  let nearby = plowTracksTree.search(bbox).features
  let ptPrev = ptNext = pathway.geometry.coordinates[0]
  while(nearby.length && (pointsTotal==0 || offset<pathwayLen-kOffsetFromPathwayEnd)){
    if(pointsTotal==0 && offset>pathwayLen-kOffsetFromPathwayEnd){offset = pathwayLen/2} //if segment is really short
    pointsTotal++;
    ptPrev = ptNext
    ptNext = ruler.along(pathway.geometry.coordinates, offset)

    let pointHasPlowTrack=false;
    for(let footway of nearby) {
      if(footway.geometry.type=="MultiLineString")
      {
        for(let coords of footway.geometry.coordinates) {
          if(isPlowTrackCloseEnough(coords, ptNext)) {
            pointHasPlowTrack = true;
          }
        }
      }
      else {
        if(isPlowTrackCloseEnough(footway.geometry.coordinates, ptNext)) {
          pointHasPlowTrack = true;
        }
      }
    }
    if(pointHasPlowTrack)pointsWithPlowTracks++;
    else pointsWithNoPlowTracks++;
    offset+=kPathwayTestStep
  }
  pathway.properties.points_tested = pointsTotal
  pathway.properties.points_with_plow_track = pointsWithPlowTracks
  pathway.properties.length = pathwayLen
  if(pointsTotal){
    if(pathwayLen<kTooShortThreshold)
    {
      pathwaysTooShort.push(pathway);
    }
    else if(pointsTotal && pointsWithPlowTracks>=pointsTotal*kPointsPlowedThreshold){  //kPointsPlowedThreshold of points have sidewalk nearby -> good
      pathwaysWithPlowTracks.push(pathway);
      pathway.properties.seasonal = 'no'
    }
    else{
      pathwaysWithNoPlowTracks.push(pathway)
    }
  }
  else{ //no sidewalks nearby at all
    pathwaysWithNoPlowTracks.push(pathway)
  }

  if(pathwayLen > 100 &&
    pointsWithNoPlowTracks>pointsTotal*(1-kPointsPlowedThreshold) &&
    pointsWithNoPlowTracks<pointsTotal*0.5)
  {
    pathwaysToSplit.push(pathway)
  }
}

function isPlowTrackCloseEnough(line, pt){
  const proj = ruler.pointOnLine(line, pt).point
  const dist = ruler.distance(proj,pt)
  //const dist = turf.pointToLineDistance(pt, line, 'meters')   //more precise but ~20 times slower
  return dist < kPointDistanceNearby
}


writer(outPathwaysWithPlowTracksPath, turf.featureCollection(pathwaysWithPlowTracks))
writer(outPathwaysToSplitPath, turf.featureCollection(pathwaysToSplit))
writer(outPathwaysTooShortPath, turf.featureCollection(pathwaysTooShort))


console.log('Pathways with plow tracks: ', pathwaysWithPlowTracks.length)
console.log('Pathways with no plow tracks: ', pathwaysWithNoPlowTracks.length)
console.log('Pathways to split: ', pathwaysToSplit.length)
console.log('Pathways too short: ', pathwaysTooShort.length)

console.timeEnd('Time')

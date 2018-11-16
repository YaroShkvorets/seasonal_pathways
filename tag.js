const reader = require('geojson-writer').reader
const xmldom = require('xmldom').DOMParser
var XMLSerializer = require('xmldom').XMLSerializer;
const fs = require('fs');


const inTaggedPathwaysFiles = ["data/generated_pathways_with_plow_tracks.json"/*,"data/generated_pathways_to_split.json"*/]

const inOsmSource = "data/osm_pathways.osm"
const outOsmSource = "data/generated_seasonal_pathways.osm"

const serializer = new XMLSerializer();
const seasonal_tags = {}    //{id->yes/no}
let totalTagged = 0

console.time('Time')
console.log('Loading tagged roads ...')
for(let i in inTaggedPathwaysFiles){
  let tagged_pathways = reader(inTaggedPathwaysFiles[i])
  for(let feature of tagged_pathways.features) {
    if(feature.properties.seasonal){
      seasonal_tags[feature.properties.id] = feature.properties.seasonal
    }
  }
}

fs.readFile(inOsmSource, 'utf-8', function (err, data) {
  if (err) {
    throw err;
  }

  const doc = new xmldom().parseFromString(data, 'application/xml');
  const ways = doc.getElementsByTagName('way');
  loop1:
  for (let i in ways) {
    let way = ways[i]
    for(let j in way.attributes){
      let attr = way.attributes[j]
      if (attr.name=='user'){
        if(attr.value=='Ottawa_seasonal_tagging'){  //if we already added this tag - skip
          continue loop1
        }
        else{
          break
        }
      }
    }
    for(let j in way.attributes){
      let attr = way.attributes[j]
      if (attr.name=='id') {
        const id = attr.value;
        const seasonal_tag = seasonal_tags['way/'+id];
        if(seasonal_tag){
          let replaced = false
          for(let k in way.childNodes){
            let node = way.childNodes[k]
            if(!node.attributes){continue}
            let attr = node.attributes[0]
            if (node.attributes[0].name=='k' && node.attributes[0].value=='seasonal') {
              replaced = true
              if(node.attributes[1].value!=seasonal_tag){
                way.setAttribute('action', 'modify');
                node.setAttribute('v', seasonal_tag)
                console.log(`For way ${id} modified seasonal tag to seasonal=${seasonal_tag}`)
                totalTagged++
              }
            }

          }
          if(!replaced){
            tag = doc.createElement("tag");
            tag.setAttribute('k', 'seasonal')
            tag.setAttribute('v', seasonal_tag);
            way.appendChild(tag)
            way.setAttribute('action', 'modify');
            //console.log(`For way ${id} added seasonal=${seasonal_tag} tag`)
            totalTagged++
          }
          //console.log('Modified way id#', id, 'sidewalk tag to', seasonal_tag)
        }

      }
    }
  }

  fs.writeFile(outOsmSource, serializer.serializeToString(doc), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Saved! Total tagged pathways:", totalTagged);
  });
});




console.timeEnd('Time')

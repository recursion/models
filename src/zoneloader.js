import {Zone} from 'symians-lib'
import Promise from 'bluebird'
import winston from 'winston'
import redis from 'redis'

const client = redis.createClient();

const WIDTH = 256;
const HEIGHT = 256;

/**
 * checks for an existing zone
 * and loads it, or
 * generates a new one
 * @returns {Promise}
 */
export function loadOrCreate(){
  return new Promise((resolve, reject)=>{
    client.on('connect', function(err){
      if (err){
        reject(err);
      }
      winston.info('Connected');
      // look for zone:1 by defaul
      client.hgetall(`zone:1`, (err, zone)=>{
        winston.info(zone);
        zone ? resolve(inflateZone(1)) : resolve(genZone());
      });
    });
  });
}

/**
 * generate a new zone
 * @returns {Promise}
 */
export function genZone(){
  winston.info('Creating new Zone');
  return new Promise((resolve, reject)=>{
    // create a zone?
    let zone = new Zone(WIDTH, HEIGHT);
    client.incr('zone', (err, zoneId)=>{

      if (err) {
        reject(err);
      }

      client.hmset(`zone:${zoneId}`,
        'width', WIDTH,
        'height', HEIGHT,
        'locations', `zone:${zoneId}:locations`
      );

      for (let col = 0; col < WIDTH; col++){
        for (let row = 0; row < WIDTH; row++){
          let index = (row*WIDTH+col);

          // create a new redis location string
          let locStr = `zone:${zoneId}:location:${index}`;

          let type = setType(col, row, WIDTH, HEIGHT);

          // create a location object
          const location = {'x': col, 'y': row, 'zoneId': zoneId, 'type': type};

          // add it to our local zone object
          zone.locations[index] = location;

          // and the redis store
          client.hmset(locStr, location);

          // push this location onto our list of zone locations
          client.rpush(`zone:${zoneId}:locations`, `zone:${zoneId}:location:${index}`);

        }
      }
      winston.info('Done');
      resolve(zone);
    });
  });
}

// set a type using col, row, mapwidth and mapheight
function setType(col, row, mapWidth, mapHeight){
  let type;
  if (col === 0 || col === mapWidth - 1 || row === 0 || row === mapHeight - 1){
    type = 'water';
  } else if (Math.random() >= 0.95){
    type = 'wall';
  } else {
    type = 'grass';
  }
  return type;
}
/**
 * loads a zone from the db
 * populates an object with the data
 * and resolves the promise with it
 * @returns {Promise}
 */
export function inflateZone(id=1){
  winston.info('Inflating zone');
  return new Promise((resolve, reject)=>{
    client.hgetall(`zone:${id}`, (err, zoneData)=>{
      if(err){
        reject(err);
      }


      let zone = new Zone(zoneData.width, zoneData.height);
      // load/populate each location within the zone
      client.lrange(`zone:${id}:locations`, 0, -1, (err, locs)=>{
        if (err) {
          reject(err);
        }

        processLocations(locs, zone);

      });
      resolve(zone);
    });
  });
}

function processLocations(locations, zone){
  const starttime = Date.now();
  locations.forEach((loc, index)=>{
    if (Date.now() - starttime < 15){
      processLocation(zone, loc);
    } else {
      setTimeout(()=> {
        processLocation(zone, loc);
      }, 1);
    }
  });
}
function processLocation(zone, loc){
  client.hgetall(loc, (err, loc)=>{
    zone.locations.push(loc);
  });
}

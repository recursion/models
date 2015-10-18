import {Zone, Mob} from 'symians-lib'
import Promise from 'bluebird'
import winston from 'winston'
import redis from 'redis'

const client = redis.createClient();
Promise.promisifyAll(redis.RedisClient.prototype);

const WIDTH = 256;
const HEIGHT = 256;

/**
 * checks for an existing zone
 * and loads it, or
 * generates a new one
 * @returns {Promise}
 */
export function loadOrCreate(emitter){
  const defaultStartZone = 1;
  return new Promise((resolve, reject)=>{
    client.on('connect', function(err){
      if (err){
        reject(err);
      }
      winston.info('Connected');
      // look for zone:1 by defaul
      client.hgetall(`zone:${defaultStartZone}`, (err, zone)=>{
        zone ? resolve(inflateZone(defaultStartZone)) : resolve(genZone(emitter));
      });
    });
  });
}

/**
 * generate a new zone
 * @returns {Promise}
 */
export function genZone(emitter){
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
        'mobs', `zone:${zoneId}:mobs`,
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
      // add a mob to the game world
      zone.mobs.push(new Mob(5, 5, emitter, zone));

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

      // create a zone
      let zone = new Zone(zoneData.width, zoneData.height);

      // populate it with data
      let results = [];
      results.push(get('mobs', id, zone));
      results.push(get('locations', id, zone));

      // once we get all the data, resolve the promise with it
      Promise.all(results)
        .then(()=>{
          resolve(zone);
        })
        .catch((err)=>{
          winston.info(err);
          throw new Error(err);
        });

    });
  });
}
function get(target, zoneId, zone){
  return new Promise((resolve, reject)=>{
    // load all mobs
    client.lrangeAsync(`zone:${zoneId}:${target}`, 0, -1)
      .then((result)=>{
        const work = [];
        result.forEach((obj)=>{
          // add each async call into our work array
          work.push(
          client.hgetallAsync(obj)
            .then((objData)=>{
              return zone[target].push(objData);
            })
          );
        });
        return Promise.all(work);
      })
      .then(()=>{
        resolve(zone);
      })
      .catch((err)=>{
        reject(err);
      });
  });
}

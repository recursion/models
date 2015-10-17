import Promise from 'bluebird'
import {expect} from 'chai'
import * as loader from './zoneLoader'

let testZone;
let testReturnType;
describe('inflateZone', ()=>{
  before((done)=>{
    testReturnType = loader.inflateZone(1)
      .then((zone)=>{
        testZone = zone;
      })
      .finally(done);
  });
  it('Returns a promise', ()=>{
    expect(testReturnType).to.be.instanceof(Promise);
  });

  it('Retrieves zone data from the db', ()=>{
    expect(testZone).to.have.property('width');
    expect(testZone).to.have.property('height');
  });
  it('doesnt do fucked up shit when you arent looking', (done)=>{
    let counter = 0;
    function keepCheckin(){
      counter ++;
      expect(testZone.locations.length).to.equal(256*256);
      console.log(testZone.locations.length);
      setTimeout(()=>{
        if(counter < 5){
          keepCheckin();
        } else {
          done();
        }
      }, 1);
    }
    keepCheckin();
  });
});

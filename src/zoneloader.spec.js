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
});

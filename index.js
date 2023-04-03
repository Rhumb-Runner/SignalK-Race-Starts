const util = require('util')

module.exports = function (app) {
  var plugin = {};

  plugin.id = 'signalk-race-starts';
  plugin.name = 'Signal K Race Starts';
  plugin.description = 'Plugin that claculates Time and Distance and Bais of a Starting Line';
  
  var unsubscribes = [];
  var boatEnd = '';
  var pinEnd = '';
  var pos = '';
  var sog = 0;
  var cog = 0;
  var twd = 0;
  var bWpt = 0;
  var fromBow = 0;
  var fromCenter = 0;
  var timeToStart = 0;
  var lineClosestPoint = 0;
  var lineCurrentDistanceTo = 0;
  var lineBiasToCourse = 0;
  var lineBiasToWind = 0;
  var lineTimeTo = 0;
  var lineTimeToBurn = 0;

function pingBoatEnd(context, path, value, callback) {
  if(context, path, value){
    boatEnd = pos
    return { state: 'COMPLETED', statusCode: 200,
      value: pos};
  } else {
    return { state: 'COMPLETED', statusCode: 400 };
  }
}
  
function pingPinEnd(context, path, value, callback) {
  if(context, path, value){
    pinEnd = pos
    return { state: 'COMPLETED', statusCode: 200,
      value: pos };
  } else {
    return { state: 'COMPLETED', statusCode: 400 };
  }
}
  
function updatePosition(metersInFront, metersToTheRight, position, bearing) {
  var currentLatitude = 0;
  var currentLongitude = 0;
  var currentLatitude = position.latitude;
  var currentLongitude = position.longitude;
  var currentHeading = bearing;
  var metersPerDegreeLatitude = 111132.954 - 559.822 * Math.cos(2 * Math.PI * currentLatitude / 360) + 1.175 * Math.cos(4 * Math.PI * currentLatitude / 360);
  var metersPerDegreeLongitude = 111132.954 * Math.cos(currentLatitude * Math.PI / 180);
  var metersPerDegreeHeading = Math.PI / 180;
  var newLatitude = currentLatitude + metersInFront * Math.cos(currentHeading * metersPerDegreeHeading) / metersPerDegreeLatitude;
  var newLongitude = currentLongitude + metersInFront * Math.sin(currentHeading * metersPerDegreeHeading) / metersPerDegreeLongitude;
  var newPosition = {
    latitude: newLatitude,
    longitude: newLongitude
  };
  return newPosition;
}

  
function closestPointMeters(boatEnd, pinEnd, position) {
  
  if (!boatEnd || !boatEnd.latitude || !boatEnd.longitude ||
      !pinEnd || !pinEnd.latitude || !pinEnd.longitude ||
      !position || !position.latitude || !position.longitude) {
    // one or more input parameters are undefined
    return null; // or whatever error handling is appropriate
  }
  
  const degToRad = Math.PI / 180;
  const earthRadiusKm = 6371;
  
  const lat1 = boatEnd.latitude * degToRad;
  const lat2 = pinEnd.latitude * degToRad;
  const lat3 = position.latitude * degToRad;
  const lon1 = boatEnd.longitude * degToRad;
  const lon2 = pinEnd.longitude * degToRad;
  const lon3 = position.longitude * degToRad;
  
  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusKm * c * 1000;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  const lat4 = Math.asin(Math.sin(lat1) * Math.cos(distance / earthRadiusKm) + Math.cos(lat1) * Math.sin(distance / earthRadiusKm) * Math.cos(bearing * degToRad));
  const lon4 = lon1 + Math.atan2(Math.sin(bearing * degToRad) * Math.sin(distance / earthRadiusKm) * Math.cos(lat1), Math.cos(distance / earthRadiusKm) - Math.sin(lat1) * Math.sin(lat4));
  
  const lat4Deg = lat4 / degToRad;
  const lon4Deg = lon4 / degToRad;
  
  const deltaLatMeters = (lat4Deg - position.latitude) * 111111;
  const deltaLonMeters = (lon4Deg - position.longitude) * 111111 * Math.cos(position.latitude * degToRad);
  
  return Math.sqrt(deltaLatMeters ** 2 + deltaLonMeters ** 2);
}

function distanceToLine(boatEnd, pinEnd, position, bearing) {
  if (!boatEnd || typeof boatEnd.latitude !== 'number' || typeof boatEnd.longitude !== 'number' ||
    !pinEnd || typeof pinEnd.latitude !== 'number' || typeof pinEnd.longitude !== 'number' ||
    !position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number' ||
    typeof bearing !== 'number') {
    // throw new Error('Invalid arguments');
    return null; //One or more points not valid (yet!)
  }

  
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
  Number.prototype.toDeg = function() {
    return this * 180 / Math.PI;
  }
  
  const R = 6371000; // metres
  const lat1 = boatEnd.latitude;
  const lat2 = pinEnd.latitude;
  const lat3 = position.latitude;
  const lon1 = boatEnd.longitude;
  const lon2 = pinEnd.longitude;
  const lon3 = position.longitude;
  const φ1 = lat1.toRad();
  const φ2 = lat2.toRad();
  const Δφ = (lat2 - lat1).toRad();
  const Δλ = (lon2 - lon1).toRad();

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;
  var θ = Math.atan2(Math.sin(Δλ)*Math.cos(φ2), Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ));
  var θ2 = bearing.toRad() / Math.PI * 180; // convert to degrees

  if (θ2 < 0) {
    θ2 += 2 * Math.PI;
  }
  if (θ < 0) {
    θ += 2 * Math.PI;
  }
  if (θ2 < θ) {
    θ2 += 2 * Math.PI;
  }
  if (θ2 > θ + 2 * Math.PI) {
    return null;
  }
  const φ3 = Math.asin(Math.sin(φ1) * Math.cos(d / R) + Math.cos(φ1) * Math.sin(d / R) * Math.cos(θ));
  const Δλ3 = Math.atan2(Math.sin(θ) * Math.sin(d / R) * Math.cos(φ1), Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ3));
  let λ3 = lon1.toRad() + Δλ3;
  λ3 = (λ3 + 3 * Math.PI) % (2 * Math.PI) - Math.PI; // normalise to -180..+180°

  const dLat = φ3.toDeg() - lat3;
  const dLon = λ3.toDeg() - lon3;
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  return dist;
}

function windBias(boatEnd, pinEnd, windDirection) {
  var latA = boatEnd.latitude;
  var latB = pinEnd.latitude;
  var lonA = boatEnd.longitude;
  var lonB = pinEnd.longitude;
  var bearing = Math.atan2(Math.sin(lonB - lonA) * Math.cos(latB), Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(lonB - lonA));
  var wBias = bearing - windDirection;
  if (wBias > Math.PI) {
    wBias -= 2 * Math.PI;
  } else if (wBias < -Math.PI) {
    wBias += 2 * Math.PI;
  }
  return wBias;
}
  
function courseBias(boatEnd, pinEnd, bearingToWaypoint) {
  var latA = boatEnd.latitude;
  var latB = pinEnd.latitude;
  var lonA = boatEnd.longitude;
  var lonB = pinEnd.longitude;
  var bearing = Math.atan2(Math.sin(lonB - lonA) * Math.cos(latB), Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(lonB - lonA));
  var bearingC = bearingToWaypoint;
  var bias = bearingC - bearing;
  if (bias > Math.PI) {
    bias -= 2 * Math.PI;
  } else if (bias < -Math.PI) {
    bias += 2 * Math.PI;
  }
  if (bias > Math.PI / 2) {
    bias = Math.PI - bias;
  } else if (bias < -Math.PI / 2) {
    bias = -Math.PI - bias;
  }
  return bias;
}
  
function timeToLine(distance, speed) {
  if (distance === null || speed === null) {
    return 9999;
  }
  return Math.round(distance / speed);
}
  
function timeToBurn(timeRemaining, time2line) {
  if (!time2line || typeof time2line !== 'number'){
    return 9999;
  }
  else {
  var burn = (timeRemaining - time2line);
  return burn;
  }
}

plugin.start = function (options, restartPlugin) {
  // Here we put our plugin logic
  app.debug('Plugin started');

  app.registerPutHandler('vessels.self', 'performance.pingBoat', pingBoatEnd, 'performance.pingBoat');
  
  app.registerPutHandler('vessels.self', 'performance.pingPin', pingPinEnd, 'performance.pingPin');
   
  
  app.streambundle
    .getSelfStream('position.navigation')
    .forEach(pos => app.debug(pos));
    
  app.streambundle
    .getSelfStream('navigation.speedOverGround')
    .forEach(sog => app.debug(sog));
    
  app.streambundle
    .getSelfStream('environment.wind.directionTrue')
    .forEach(twd => app.debug(twd));
    
  app.streambundle
    .getSelfStream('navigation.courseOverGroundTrue')
    .forEach(cog => app.debug(cog));
    
  app.streambundle
    .getSelfStream('navigation.courseGreatCircle.nextPoint.bearingTrue')
    .forEach(bWpt => app.debug(bWpt));
    
  app.streambundle
    .getSelfStream('performance.startTimer')
    .forEach(timeToStart => app.debug(timeToStart));
    
  app.streambundle
    .getSelfStream('sensors.gps.fromBow')
    .forEach(fromBow => app.debug(fromBow));
    
  app.streambundle
    .getSelfStream('sensors.gps.fromCenter')
    .forEach(fromCenter => app.debug(fromCenter));

  let newPos = updatePosition(fromBow, fromCenter, pos, cog);
  let lineClosestPoint = closestPointMeters(boatEnd, pinEnd, newPos);
  let lineCurrentDistanceTo = distanceToLine(boatEnd, pinEnd, newPos, cog);
  let lineBiasToCourse = courseBias(boatEnd, pinEnd, bWpt);
  let lineBiasToWind = windBias(boatEnd, pinEnd, twd);
  let lineTimeTo = timeToLine(lineCurrentDistanceTo, sog);
  let lineTimeToBurn = timeToBurn(timeToStart, lineTimeTo);

 
  app.handleMessage('signalk-race-starts', {
    updates: [{
      values: [
        {
          path: 'perfromance.start.closestPoint',
          value: lineClosestPoint
        },
        {
          path: 'perfromance.start.currentCourseDistance',
          value: lineCurrentDistanceTo
        },
        {
          path: 'perfromance.start.biasToCourse',
          value: lineBiasToCourse
        },
        {
          path: 'perfromance.start.biasToWind',
          value: lineBiasToWind
        },
        {
          path: 'perfromance.start.timeToLine',
          value: lineTimeTo
        },
        {
          path: 'perfromance.start.timeToBurn',
          value: lineTimeToBurn
        }]
    }]
  })
};
  
plugin.stop = function () {
  // Here we put logic we need when the plugin stops
  app.debug('Plugin stopped');
  unsubscribes.forEach(f => f());
  unsubscribes = [];
};

plugin.schema = {
  type: 'object',
  required: ['some_string', 'some_other_number'],
  properties: {
    some_string: {
      type: 'string',
      title: 'Some string that the plugin needs'
    },
    some_number: {
      type: 'number',
      title: 'Some number that the plugin needs',
      default: 60
    },
    some_other_number: {
      type: 'number',
      title: 'Some other number that the plugin needs',
      default: 5
    }
  }
};

  return plugin;
};

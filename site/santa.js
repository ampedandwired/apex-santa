var santa = (function($) {
  var config = {
    bucket: "apexsanta-s3bucket-xyojbppcy9qj",
    region: "ap-southeast-2",
    local: true,
    refreshSeconds: 15
  };

  config.baseUrl = "https://s3-" + config.region + ".amazonaws.com/" + config.bucket;

  var events = [
    {
      id: "berowra-heights-2016",
      kml: "berowra-heights2-2016.kml",
      title: "Berowra Heights",
      start_time: "2016-12-16 19:00:00+11",
      start_time_nice: "Friday 16th December, 7pm",
      description: "Starts at Coles and finishes at Warrina Oval. Come and join us afterwards at Warrina Oval for a BBQ."
    },
    {
      id: "berowra-2016",
      kml: "berowra2-2016.kml",
      title: "Berowra",
      start_time: "2016-12-17 18:00:00+11",
      start_time_nice: "Saturday 17th December, 6pm",
      description: "Starts at Coles and finishes at Berowra Oval. There will be a BBQ, jumping castle and Santa photos at the oval afterwards."
    },
    {
      id: "blacktown-2016",
      kml: "berowra2-2016.kml",
      title: "Blacktown",
      start_time: "2016-12-18 14:00:00+11",
      start_time_nice: "Sunday 18th December, 2pm",
      description: "Cruise the streets of Blacktown"
    }
  ];

  var currentTime = new Date().getTime();
  events = events.filter(function(e) {
    return Date.parse(e.start_time) >= currentTime - (24*60*60*1000);
  }).sort(function(a, b) {
    return a.start_time - b.start_time;
  });

  function _getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  function _getCredentials() {
    id = _getParameterByName("id");
    secret = _getParameterByName("secret");
    if (id !== null && secret !== null) {
      AWS.config.update({accessKeyId: id, secretAccessKey: secret});
      AWS.config.region = 'ap-southeast-2';
      return {
        id: id,
        secret: secret
      }
    } else {
      return null;
    }
  }

  var data = {
    events: events,
    currentEvent: events[0],
    credentials: _getCredentials(),
    tracking: false,
    status: null,
    error: null
  };

  function _refreshCurrentLocation(map) {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var myloc = new google.maps.Marker({
          position: {lat: position.coords.latitude, lng: position.coords.longitude},
          icon: new google.maps.MarkerImage('//maps.gstatic.com/mapfiles/mobile/mobileimgs2.png',
                                            new google.maps.Size(22,22), new google.maps.Point(0,18), new google.maps.Point(11,11)),
          clickable: false,
          shadow: null,
          zIndex: 900,
          map: map
        });
      });
    }
  }

  function _setSantaLocation() {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        if (data.tracking) {
          var eventId = data.currentEvent.id
          var loc = {lat: position.coords.latitude, lng: position.coords.longitude, time: new Date().getTime()};
          var locString = JSON.stringify(loc);
          console.log("Update santa location " + eventId + ": " + locString);
          var s3 = new AWS.S3();
          s3.putObject({
            Bucket: config.bucket,
            Key: "live/" + eventId + ".json",
            Body: locString,
            ACL: "public-read"
          }, function(err, result) {
            if (err) {
              console.log("Error updating santa location: " + err);
              data.error = err;
            }
          });
        }
      }, function(err) {
        data.error = err.message;
      });
    } else {
      console.log("5");
      data.error = "Unable to determine your current location";
    }
  }

  function timeTill(date) {
    var seconds = Math.floor((date - new Date()) / 1000);
    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes";
    }
    return Math.floor(seconds) + " seconds";
  }

  function _santaStatus(eventTime, lastSantaUpdateTime) {
    var currentTime = new Date().getTime();
    console.log(eventTime, currentTime, lastSantaUpdateTime);
    var santaSeenRecently = lastSantaUpdateTime && (currentTime - lastSantaUpdateTime) < 15*60*1000;
    var santaSeenSinceEventStarted = lastSantaUpdateTime && lastSantaUpdateTime >= eventTime;
    var eventStarted = currentTime >= eventTime;
    var eventNearlyStarted = currentTime >= (eventTime - 15*60*1000);
    console.log("santaSeenRecently " + santaSeenRecently, "santaSeenSinceEventStarted " + santaSeenSinceEventStarted, "eventStarted " + eventStarted, "eventNearlyStarted "+eventNearlyStarted);
    var status = null;

    if (eventStarted && !santaSeenSinceEventStarted) {
      status = "Santa is harnessing up his reindeer and will be here soon!";
    } else if (eventStarted && santaSeenSinceEventStarted && !santaSeenRecently) {
      status = "Santa is on his way back to the North Pole. See you next year!";
    } else if (eventNearlyStarted && santaSeenRecently) {
      status = "Santa is in town! You can find him on the map below.";
    } else {
      if (!eventStarted) {
        status = "Only " + timeTill(Date.parse(data.currentEvent.start_time)) + " to go until Santa's visit!";
      } else {
        status = "Santa is back in the North Pole. See you next year!"
      }
    }

    return status;
  }

  function _refreshSantaLocation() {
    console.log("Refresh Santa location" + data.currentEvent.id);
    $.ajax({
      url: config.baseUrl + "/live/" + data.currentEvent.id + ".json",
      type: "GET",
      success: function(result) {
        console.log("Refreshed Santa location " + data.currentEvent.id + ": " + JSON.stringify(result));
        var loc = JSON.parse(result);
        var locTime = loc.time;
        data.status = _santaStatus(Date.parse(data.currentEvent.start_time), locTime);
        var image = {
          url: "/assets/santa.png",
          size: new google.maps.Size(40, 40),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(20, 20)
        };

        var santaLoc = new google.maps.Marker({
          position: loc,
          clickable: false,
          icon: image,
          shadow: null,
          zIndex: 910,
          map: data.map
        });
      },
      error: function(jqXHR, textStatus, err) {
        console.log(err);
        data.status = _santaStatus(Date.parse(data.currentEvent.start_time), null);
      }
    });
  }

  var initMap = function() {
    var kmlUrl = config.baseUrl + "/data/" + data.currentEvent.kml;
    var map = map = new google.maps.Map(document.getElementById('map'));
    data.map = map;
    var kmlLayer = new google.maps.KmlLayer(kmlUrl, {
      map: map,
      preserveViewport: false,
      suppressInfoWindows: true,
    });

    _refreshCurrentLocation(map);
    (function updateSanta(){
      _refreshSantaLocation();
      setTimeout(updateSanta, config.refreshSeconds * 1000);
    })();
  };

  var setCurrentEvent = function(index) {
    var newEvent = data.events[index];
    if (newEvent.id !== data.currentEvent.id) {
      data.tracking = false;
      data.currentEvent = newEvent;
      initMap();
    }
  };

  var startTracking = function() {
    if (!data.tracking) {
      data.tracking = true;
      (function updateTracking(){
        if (data.tracking) {
          _setSantaLocation();
          setTimeout(updateTracking, config.refreshSeconds * 1000);
        }
      })();
    }
  };

  var stopTracking = function() {
    data.tracking = false;
  };

  // Fixes google maps height when it's inside a div
  $(window).resize(function () {
    var h = $(window).height();
    var offsetTop = 250;
    $('#map').css('height', (h - offsetTop));
  }).resize();

  var vue = new Vue({
    el: '#santa',
    data: data,
    methods: {
      initMap: initMap,
      setCurrentEvent: setCurrentEvent,
      startTracking: startTracking,
      stopTracking: stopTracking
    }
  });

  return vue;

})(window.jQuery);

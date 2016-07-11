var santa = (function($) {
  var config = {
    bucket: "apexsanta-s3bucket-xyojbppcy9qj",
    region: "ap-southeast-2",
    local: true,
    refreshSeconds: 15
  };

  var events = [
    {
      id: "berowra-heights-2016",
      kml: "berowra-heights2-2016.kml",
      title: "Berowra Heights",
      start_time: "2016-12-20 19:00:00",
      description: "Starts at Coles and finishes at Warrina Oval"
    },
    {
      id: "berowra-2016",
      kml: "berowra2-2016.kml",
      title: "Berowra",
      start_time: "2016-12-21 19:00:00",
      description: "Starts at Coles and finishes at Berowra Oval"
    },
    {
      id: "blacktown-2016",
      kml: "berowra2-2016.kml",
      title: "Blacktown",
      start_time: "2016-12-22 19:00:00",
      description: "Cruise the streets of Blacktown"
    }
  ];

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
      });
    } else {
      data.error = "Unable to determine your current location";
    }
  }

  function _refreshSantaLocation() {
    var liveBaseUrl = "";
    if (config.local) {
      var liveBaseUrl = "http://" + config.bucket + ".s3-website-ap-southeast-2.amazonaws.com";
    }
    console.log("Refresh Santa location" + data.currentEvent.id);
    $.ajax({
      url: liveBaseUrl + "/live/" + data.currentEvent.id + ".json",
      type: "GET",
      success: function(result) {
        console.log("Refreshed Santa location " + data.currentEvent.id + ": " + JSON.stringify(result));
        var loc = JSON.parse(result);
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
        console.log("Refresh Santa error: " + err);
      }
    });
  }

  var initMap = function() {
    if (config.local) {
      var kmlBaseUrl = "http://" + config.bucket + ".s3-website-ap-southeast-2.amazonaws.com";
    } else {
      var currentUrl = window.location;
      var kmlBaseUrl = currentUrl.protocol + "//" + currentUrl.host
    }

    var kmlUrl = kmlBaseUrl + "/data/" + data.currentEvent.kml;
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

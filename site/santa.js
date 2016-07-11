var santa = (function($) {
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
    }
  ];

  var data = {
    events: events,
    currentEvent: events[0]
  };

  var kmlBaseUrlOverride = "http://apexsanta-s3bucket-xyojbppcy9qj.s3-website-ap-southeast-2.amazonaws.com";

  var initMap = function initMap() {
    if (kmlBaseUrlOverride !== null) {
      var kmlBaseUrl = kmlBaseUrlOverride;
    } else {
      var currentUrl = window.location;
      var kmlBaseUrl = currentUrl.protocol + "//" + currentUrl.host
    }

    var kmlUrl = kmlBaseUrl + "/data/" + data.currentEvent.kml;
    console.log("KML: " + kmlUrl);
    var map = new google.maps.Map(document.getElementById('map'));
    var kmlLayer = new google.maps.KmlLayer(kmlUrl, {
      map: map,
      preserveViewport: false,
      suppressInfoWindows: true,
    });
  };

  var setCurrentEvent = function setCurrentEvent(index) {
    data.currentEvent = data.events[index];
    initMap();
  }

  var vue = new Vue({
    el: '#santa',
    data: data,
    methods: {
      initMap: initMap,
      setCurrentEvent: setCurrentEvent
    }
  });

  return vue;

})(window.jQuery);

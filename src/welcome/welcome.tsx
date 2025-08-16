import { DirectionsRenderer, GoogleMap, useJsApiLoader, StandaloneSearchBox, MarkerF } from '@react-google-maps/api'
import { useRef, useState, useCallback, useEffect  } from "react";

interface Trip {
  distance: string;
  duration: string;
  price: number;
  origin: string;
  destination: string;
}

export function Welcome() {
  function quote(){
    console.log("quote");
    getDirections();
  }

  function refresh(){
    location.reload();
  }

  function schedule(){
    console.log("schedule");
  }
  
  const [markerOrigin, setMarkerOrigin] = useState(null);
  const [markerDestination, setMarkerDestination] = useState(null);
  const refOrigin = useRef(null);
  const refDestination = useRef(null);
  const [map, setMap] = useState(null);
  //const [origin_id, setOrigin_id] = useState(null);
  const [distance, setDistance] = useState(0);
  const [time, setTime] = useState(0);
  const [price, setPrice] = useState(0);
  const [breakdown, setBreakdown] = useState<Trip[]>([]);
  const [directions, setDirections] = useState(null);
  const apiKey = import.meta.env.VITE_GOOGLEMAPS_API_KEY;
  const backEnd = import.meta.env.VITE_BACKEND;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: ["places"]
  })

  //console.log("isLoaded: " + isLoaded);

  // Obtiene la ruta del mapa del origen A al destino B
  const getDraw = () => {
    console.log("getDraw");
    
    if(_markers.length == 2 && directions == null){ 

      if(!markerDestination || !markerDestination)
        return;

      // Hacer que pase por el puente de laredo
      let useLaredoBridge = false;
      if( 
        ((isNL(markerOrigin) || isCDMX(markerOrigin)) && isUSA(markerDestination)) // MX - USA
        || ( isUSA(markerOrigin) && (isNL(markerDestination) || isCDMX(markerDestination)) ) // USA - MX
      ){
        //if(isTexas(markerDestination) || isArizona(markerDestination.text) || isCalifornia(markerDestination) || isWashington(markerDestination)){
          useLaredoBridge = true;
        //}
      }

      let waypoints = []
      if(useLaredoBridge){
        let jBridge_laredo = {
          location: { lat: 27.5004734, lng: -99.5027081 }, // Puente Juarez-Lincoln International Bridge
          stopover: true
        }
        waypoints.push(jBridge_laredo);
      }

      let jRoute = {
        origin: markerOrigin.position,
        destination: markerDestination.position,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      }

      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        jRoute,
        (result, status) => {

          console.log("result");
          console.log(result);
          
          if (status === google.maps.DirectionsStatus.OK) {
            setDirections(result);
          } else {
            console.error(`error fetching directions ${result}`);
          }
        }
      );
    }
  }

  // Obtiene los datos desde el backend/lambda con los valores de tiempo, distancia y precio
  const getDirections = () => {
    console.log("getDirections");

    console.table(_markers);
    if(_markers.length == 2){
      //fetch(backEnd+'/api/getDirections', {
      fetch(backEnd, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(_markers)
      })
        .then(res => res.json())
        .then(data => { 
          console.log(data);
          setDistance(data.distance);
          setTime(data.duration);
          setPrice(numberToCurrency(data.price));


          setBreakdown(data.breakdown || []);
          if(data.distance_miles){
            setDistance(data.distance_miles + " millas");
          }
          if(data.duration_seconds){
            setTime(secondsToDHM(data.duration_seconds));
          }
        });
    }
  }

  const numberToCurrency = (number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  }

  function secondsToDHM(seconds) {
    seconds = Number(seconds);

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    let result = "";
    if(d) result += d + " días ";
    if(h) result += h + " horas ";
    if(m) result += m + " minutos ";

    return result;
  }
  
  var _markers = [];
  useEffect(() => {
     if (markerOrigin && markerDestination) {
      console.log(`useEffect`);
      getDirections();

      getDraw();
    }
  }, [markerOrigin, markerDestination]);

  const handleOnPlacesChangedOrigin = () => {
    console.log("handleOnPlacesChangedOrigin");
    let address = refOrigin.current.getPlaces();
    console.log(address);

    if(address){
      let a = address[0];
      console.log("Selected: " + a.formatted_address);
      
      //setOrigin_id(a.place_id);

      let jState = getState(address);
      let jOrigin = { 
        id: 1,
        place_id: a.place_id,
        position: { 
          lat: a.geometry.location.lat(), 
          lng: a.geometry.location.lng()
        },
        text: a.formatted_address,
        state: jState.state,
        country: jState.country
      }

      console.log("jOrigin");
      console.log(jOrigin);

      setMarkerOrigin(jOrigin);
      setDirections(null);
    }
  }

  const handleOnPlacesChangedDestination = () => {
    console.log("handleOnPlacesChangedDestination");
    let address = refDestination.current.getPlaces();
    if(address){
      console.log(address);    

      let a = address[0];
      let jState = getState(address);

      let jDestination = { 
        id: 2, 
        place_id: a.place_id,
        position: { 
          lat: a.geometry.location.lat(), 
          lng: a.geometry.location.lng()
        },
        text: a.formatted_address,
        state: jState.state,
        country: jState.country
      }
      console.log("jDestination");
      console.log(jDestination);

      setMarkerDestination(jDestination);
      setDirections(null);
    }
  }

  function getState(address){
    let address_components = address[0].address_components;
    let state = "", country = "";
    if(address_components) {
      address_components.forEach(c => {
          if (c.types.includes("administrative_area_level_1")) {
              state = c.short_name;
          }
          if (c.types.includes("country")) {
              country = c.short_name;
          }
      });

      return { 
        state: state, 
        country: country
      };
    }
  }
  
  function searchLocations(location, arr) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return arr.some(element => location.includes(element));
  }
  function isArizona(location){
      return location.includes("Kingman, AZ") || location.includes('Phoenix, AZ') || location.includes('Sahuarita, AZ') || 
          location.includes('Tucson, AZ') || location.includes('Willcox, AZ')
  }
  function isCalifornia(marker){
    return marker.state == "CA" && marker.country == "US";
  }
  function isCDMX(marker){
      return marker.country == "MX" && marker.state == "CDMX";
  }
  function isMonterrey(marker){
      return marker.country == "MX" && marker.state == "N.L." && 
      // Incluir area metropolitana
      ( marker.text.includes("Monterrey") || marker.text.includes("Apodaca") || marker.text.includes("San Nicolás de los Garza")  || marker.text.includes("Guadalupe") 
      || marker.text.includes("General Escobedo") );
  }
  function isNL(marker){
      return marker.country == "MX" && marker.state == "N.L.";
  }
  function isTexas(marker){
    return marker.state == "TX" && marker.country == "US";
  }
  function isUSA(marker){
    return marker.country == "US";
  }
  function isWashington(marker){
    return marker.state == "WA" && marker.country == "US";
  }

  const containerStyle = {
    width: '100%',
    height: '800px',
  }
  
  const center = {
    lat: 24.593,
    lng: -101.285
  }
  
  if(markerOrigin)
    _markers.push(markerOrigin);
  if(markerDestination)
    _markers.push(markerDestination);

  const onLoad = useCallback(function callback(map) {
    console.log("onLoad");

    // This is just an example of getting and using the map instance!!! don't just blindly copy!
    //const bounds = new window.google.maps.LatLngBounds(center)
    //map.fitBounds(bounds)

    setMap(map);
  }, [])

  const onUnmount = useCallback(function callback(map) {
    setMap(null)
  }, [])

  return (
    <main>
        <div className="topFixed">
            <div className="header">

                <div className="divLogo">
              
                    <span className="name logo"></span>
                </div>
                <span className="link hide" onClick={refresh}>Reservar</span>
            </div> 
        </div>
        
        <div className="section1 divInputs">
            <div className="content">
                <div className="line1 flex">
                    <div className="divOrigin flex flex1">
                        {isLoaded && 
                        <StandaloneSearchBox
                          onLoad={(ref) => refOrigin.current = ref}
                          onPlacesChanged={handleOnPlacesChangedOrigin}>                        
                          <input type="text" id="txtOrigin" placeholder="Origen" />
                        </StandaloneSearchBox>
                        }
                        {isLoaded && 
                        <StandaloneSearchBox
                          onLoad={(ref) => refDestination.current = ref}
                          onPlacesChanged={handleOnPlacesChangedDestination}>                        
                          <input type="text" id="txtDestination" placeholder="Destino" />
                        </StandaloneSearchBox>
                        }
                    </div>
                    <input type="button" id="btnQuote" value="Cotizar" onClick={quote} />
                </div>

                <div className='lblResult'>
                    <div className='main'>
                      Tiempo: {time} <br />
                      Distancia: {distance} <br />
                      Precio: {price} <br />
                    </div>                    

                  {breakdown.length > 0 &&
                    <div className='details'>
                      <br />
                      Detalles del viaje: <br />
                      {
                        breakdown.map((b, i) => (
                          <div key={i}>
                            Origen: {b.origin} <br />
                            Destino: {b.destination} <br />
                            Tiempo: {b.duration} <br />
                            Distancia: {b.distance} <br />
                            {b.pricePerMile > 0 &&
                              <div>
                                Precio por milla: ${b.pricePerMile || 0} <br />
                                Precio: {b.distance} * ${b.pricePerMile || 0} = {numberToCurrency(b.distance.match(/\d+(\.\d+)?/)[0] * b.pricePerMile)}  <br />
                              </div>
                            }
                            {b.price > 0 &&
                              <div>
                                Precio: {numberToCurrency(b.price)}  <br />
                              </div>
                            }
                            
                            <br />
                          </div>
                        ))
                      }
                    </div>
                  }
                </div>

                <div className="dates">

                </div>
                
                <div id="divResult">
                  Total: $<span id="lblTotal"></span>
                  <input type="button" id="btnSchedule" value="Agendar viaje" onClick={schedule} />
                </div>

                <div id="divMap">
                  
                {isLoaded && 
                  <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={center}
                  zoom={6}
                  onLoad={onLoad}
                  onUnmount={onUnmount}
                >

                {
                  directions !== null && (
                    <DirectionsRenderer
                      directions={directions}
                      defaultOptions={{
                        suppressMarkers: true
                      }}
                    />
                  )
                }

                  {                  
                  /* Child components, such as markers, info windows, etc. */
                  // Coloca AdvancedMarkers en el mapa
                  _markers.map((marker) => (
                    <MarkerF key={marker.id} position={marker.position}>
                      
                    </MarkerF>
                  ))
                  }
                  <></>
                </GoogleMap>
                  }
                </div>
            </div>
        </div>
    </main>
  );
}
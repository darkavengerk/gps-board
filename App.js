import React, { Component } from 'react'
import { Platform, Text, View, SafeAreaView, FlatList, StyleSheet, TextInput, KeyboardAvoidingView } from 'react-native'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import * as Permissions from 'expo-permissions'

const SERVER_ADDR = 'http://ec2-13-211-212-5.ap-southeast-2.compute.amazonaws.com:20666'

function req(addr, opt) {
  return fetch(SERVER_ADDR + addr, opt? opt : {})
}

//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
//:::                                                                         :::
//:::  This routine calculates the distance between two points (given the     :::
//:::  latitude/longitude of those points). It is being used to calculate     :::
//:::  the distance between two locations using GeoDataSource (TM) prodducts  :::
//:::                                                                         :::
//:::  Definitions:                                                           :::
//:::    South latitudes are negative, east longitudes are positive           :::
//:::                                                                         :::
//:::  Passed to function:                                                    :::
//:::    lat1, lon1 = Latitude and Longitude of point 1 (in decimal degrees)  :::
//:::    lat2, lon2 = Latitude and Longitude of point 2 (in decimal degrees)  :::
//:::    unit = the unit you desire for results                               :::
//:::           where: 'M' is statute miles (default)                         :::
//:::                  'K' is kilometers                                      :::
//:::                  'N' is nautical miles                                  :::
//:::                                                                         :::
//:::  Worldwide cities and other features databases with latitude longitude  :::
//:::  are available at https://www.geodatasource.com                         :::
//:::                                                                         :::
//:::  For enquiries, please contact sales@geodatasource.com                  :::
//:::                                                                         :::
//:::  Official Web site: https://www.geodatasource.com                       :::
//:::                                                                         :::
//:::               GeoDataSource.com (C) All Rights Reserved 2018            :::
//:::                                                                         :::
//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

function distance(lat1, lon1, lat2, lon2, unit) {
  if ((lat1 == lat2) && (lon1 == lon2)) {
    return 0;
  }
  else {
    var radlat1 = Math.PI * lat1/180;
    var radlat2 = Math.PI * lat2/180;
    var theta = lon1-lon2;
    var radtheta = Math.PI * theta/180;
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = dist * 180/Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit=="K") { dist = dist * 1.609344 }
    if (unit=="N") { dist = dist * 0.8684 }
    return dist.toFixed(2);
  }
}

export default class App extends Component {
  state = {
    location: null,
    errorMessage: null,
    textInput: '',
    board: [],
  }

  componentWillMount() {
    if (Platform.OS === 'android' && !Constants.isDevice) {
      this.setState({
        errorMessage: 'Oops, this will not work on Sketch in an Android emulator. Try it on your device!',
      })
    } else {
      this._getList()
      this.updateLocation()
    }
  }

  onChangeText = (textInput) => {
    this.setState({textInput})
  }

  onTextSubmit = async () => {
    const text = this.state.textInput
    if(!text) return;
    const location = await this._getLocationAsync()
    await req('/api/board/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, location })
    })
    this.setState({ textInput: ''})
    this._getList()
  }

  updateLocation = async () => {
    await this._getLocationAsync()
    await this.getAddress()
  }

  getAddress = async () => {
    const location = await Location.getCurrentPositionAsync({})
    const result = await Location.reverseGeocodeAsync(location.coords)
    if(!result || !result[0]) return ''
    const info = result[0]
    const address = `${info.region} ${info.city} ${info.name}`
    this.setState({ address })
    return address
  }

  getDistDiff = item => {
    const { latitude, longitude, altitude } = item
    if(!this.state.location) return ''
    const { location: {latitude:lat_phone, longitude:lon_phone }} = this.state
    return distance(latitude, longitude, lat_phone, lon_phone, 'K')
  }

  _getList = async () => {
    const response = await req('/api/board/list')
    const json = await response.json()
    const board = json.result
    this.setState({ board })
  }

  _getLocationAsync = async () => {
    let { status } = await Permissions.askAsync(Permissions.LOCATION)
    if (status !== 'granted') {
      this.setState({
        errorMessage: 'Permission to access location was denied',
      })
    }

    let { coords } = await Location.getCurrentPositionAsync({})
    this.setState({ location: coords })
    return coords
  }

  _getBoard = () => {
    const { board } = this.state;
    return board.map((item, i) => item.text? 
      <View style={{width: '100%', flexDirection: 'row', alignItems: 'center'}} key={i}>
        <Text style={styles.listitem}>{item.text}</Text>
        <Text>{`${this.getDistDiff(item)} km`}</Text>
      </View> : null)
  }

  getItem = data => {
    const { item, index }= data
    return item.text? <View style={{width: '100%', flexDirection: 'row', alignItems: 'center'}, styles.item}>
        <Text style={styles.listitem}>{item.text}</Text>
        <Text>{`${this.getDistDiff(item)} km`}</Text>
      </View> : null
  }

  _keyExtractor = (item, index) => String(index)

  render() {
    let text = 'Waiting..'
    if (this.state.errorMessage) {
      text = this.state.errorMessage
    } else if (this.state.location) {
      text = this.state.address
    }

    return (
      <View style={styles.container}>
        <Text style={styles.paragraph}>{text}</Text>
        <SafeAreaView style={{backgroundColor:'blue', width: '100%', flex: 1}}>
          <FlatList
            data={this.state.board}
            renderItem={this.getItem}
            keyExtractor={this._keyExtractor}
          />

        </SafeAreaView>
        <KeyboardAvoidingView style={{position: 'absolute', left: 0, right: 0, bottom: 0}} behavior="position">
          <TextInput
            style={styles.textInput}
            onChangeText={text => this.onChangeText(text)}
            onSubmitEditing={this.onTextSubmit}
            value={this.state.textInput}
          />
        </KeyboardAvoidingView>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#f9c2ff',
    marginVertical: 3,
    marginHorizontal : 3,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius:10,
  },
  textInput: { 
    height: 40,
    width: '100%',
    borderColor: 'gray',
    borderWidth: 1,
    backgroundColor: 'white',
    paddingHorizontal: 10,
  },
  listitem: {
    width: '50%',
    textAlignVertical: "center",
    lineHeight: 50,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#d6d7da',
  }
})
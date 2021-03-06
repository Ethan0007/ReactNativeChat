import React, { Component } from 'react'
import {
  View,
  Text,
  Image,
  ListView,
  TouchableHighlight,
  Alert,
  StyleSheet
} from 'react-native'

import {APP_ID, PULLDOWN_DISTANCE} from '../consts';
import TopBar from '../components/topBar';
import moment from 'moment';
import SendBird from 'sendbird';
import styles from './styles/groupChannel';
var sb = null;
var ds = null;

export default class GroupChannel extends Component {
  constructor(props) {
    super(props);
    sb = SendBird.getInstance();
    ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    this.state = {
      channelList: [],
      dataSource: ds.cloneWithRows([]),
      listQuery: sb.GroupChannel.createMyGroupChannelListQuery(),
      editMode: false
    };
    this._getChannelList = this._getChannelList.bind(this);
    this._onHideChannel = this._onHideChannel.bind(this);
    this._refresh = this._refresh.bind(this);
    this._channelUpdate = this._channelUpdate.bind(this);
    this._refreshChannelList = this._refreshChannelList.bind(this);
  }

  componentDidMount() {
    this._getChannelList();

    // channel handler
    var _SELF = this;
    var ChannelHandler = new sb.ChannelHandler();
    ChannelHandler.onUserJoined = function(channel, user) {
      _SELF._channelUpdate(channel);
    };
    ChannelHandler.onUserLeft = function(channel, user) {
      _SELF._channelUpdate(channel);
    };
    ChannelHandler.onChannelChanged = function(channel) {
      _SELF._channelUpdate(channel);
    };
    sb.addChannelHandler('ChannelHandlerInList', ChannelHandler);

    var ConnectionHandler = new sb.ConnectionHandler();
    ConnectionHandler.onReconnectSucceeded = function(){
      _SELF._refreshChannelList();
    }
    sb.addConnectionHandler('ConnectionHandlerInList', ConnectionHandler);
  }

  componentWillUnmount() {
    sb.removeChannelHandler('ChannelHandlerInList');
    sb.removeChannelHandler('ConnectionHandlerInList');
  }

  _channelUpdate(channel) {
    if(!channel) return;

    var self = this;
    var _exist = false;
    var _list = self.state.channelList.filter(function(ch) {
      return channel.url != ch.url
    });

    _list.unshift(channel);

    self.setState({
      channelList: _list,
      dataSource: ds.cloneWithRows(_list)
    });
  }

  _refresh(channel) {
    this._channelUpdate(channel);
  }

  _channelTitle(members) {
    var _members = [];
    members.forEach(function(user) {
      if (user.userId != sb.currentUser.userId) {
        _members.push(user);
      }
    });
    var _title = _members.map(function(elem){
      if (elem.userId != sb.currentUser.userId) {
          return elem.nickname;
      }
    }).join(",");
    _title = _title.replace(',,', ',');
    return (_title.length > 15) ? _title.substring(0, 11) + '...' : _title;
  }

  _onChannelPress(channel) {
    var self = this;
    if (self.state.editMode) {
      Alert.alert(
        'Group Channel Edit',
        null,
        [
          {text: 'leave', onPress: () => {
            channel.leave(function(response, error) {
              if (error) {
                console.log(error);
                return;
              }
              self._onHideChannel(channel);
            });
          }},
          {text: 'hide', onPress: () => {
            channel.hide(function(response, error) {
              if (error) {
                console.log(error);
                return;
              }
              self._onHideChannel(channel);
            });
          }},
          {text: 'Cancel'}
        ]
      )
    } else {
      self.props.navigator.push({name: 'chat', channel: channel, _onHideChannel: this._onHideChannel, refresh: this._refreshChannelList});
    }
  }

  _onHideChannel(channel) {
    this.setState({channelList: this.state.channelList.filter((ch) => {
      return channel.url !== ch.url
    })}, ()=> {
      this.setState({
        dataSource: ds.cloneWithRows(this.state.channelList)
      });
    });
  }

  _refreshChannelList() {
    var self = this;
    var listQuery = sb.GroupChannel.createMyGroupChannelListQuery();
    listQuery.next(function(channelList, error){
      if (error) {
        console.log(error);
        return;
      }
      self.setState({ listQuery: listQuery, channelList: channelList, dataSource: ds.cloneWithRows(channelList)});

    });
  }

  _getChannelList() {
    var self = this;
    self.state.listQuery.next(function(channelList, error){
      if (error) {
        console.log(error);
        return;
      }
      var newList = self.state.channelList.concat(channelList);
      self.setState({ channelList: newList, dataSource: ds.cloneWithRows(newList)});

    });
  }

  _onBackPress() {
    this.props.navigator.pop();
  }

  _onGroupChannel() {
    var self = this;
    if (self.state.editMode) {
      Alert.alert(
        'Group Channel Event',
        null,
        [
          {text: 'Done', onPress: () => {
            self.setState({editMode: false});
          }}
        ]
      )
    } else {
      Alert.alert(
        'Group Channel Event',
        null,
        [
          {text: 'Edit', onPress: () => {
            self.setState({editMode: true});
          }},
          {text: 'Create', onPress: () => {
            self.props.navigator.push({name: 'inviteUser', refresh: self._refreshChannelList});
          }},
          {text: 'Cancel'}
        ]
      )
    }
  }

  render() {
    return (
      <View style={styles.container}>
        <TopBar
          onBackPress={this._onBackPress.bind(this)}
          onGroupChannel={this._onGroupChannel.bind(this)}
          title='Group Channel'
           />

        <View style={styles.listContainer}>
          <ListView
            enableEmptySections={true}
            onEndReached={() => this._getChannelList()}
            onEndReachedThreshold={PULLDOWN_DISTANCE}
            dataSource={this.state.dataSource}
            renderRow={(rowData) =>
              <TouchableHighlight onPress={() => this._onChannelPress(rowData)}>
                <View style={styles.listItem}>
                  <View style={styles.listIcon}>
                    <Image style={styles.channelIcon} source={{uri: rowData.coverUrl.replace('http://', 'https://')}} />
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={styles.titleLabel}>{this._channelTitle(rowData.members)}</Text>
                    <Text style={styles.memberLabel}>{rowData.lastMessage ? ( rowData.lastMessage.message && rowData.lastMessage.message.length > 15 ? rowData.lastMessage.message.substring(0, 11) + '...' : rowData.lastMessage.message ) : '' }</Text>
                  </View>
                  <View style={{flex: 1, flexDirection: 'row', alignItems: 'flex-end', marginRight: 10}}>
                    <View style={{flex: 1, flexDirection: 'column', alignItems: 'flex-end', marginRight: 4}}>
                      <Text style={{color: '#861729'}}>{rowData.unreadMessageCount}</Text>
                    </View>
                     <View style={{flex: 1, alignItems: 'flex-end'}}>
                       <Text style={styles.descText}>{rowData.memberCount} members</Text>
                       <Text style={styles.descText}>{(!rowData.lastMessage || rowData.lastMessage.createdAt == 0) ? '-' : moment(rowData.lastMessage.createdAt).format('MM/DD HH:mm')}</Text>
                     </View>
                  </View>
                </View>
              </TouchableHighlight>
            }
          />
        </View>
      </View>
    )
  }

}

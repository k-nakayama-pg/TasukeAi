var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
var crypto = require("crypto");
var async = require('async');
var fs = require('fs');

global.nakayama_kazuya_line_id = 'U2aca57e8b1a096a56b1199ae5311f7e5';
global.nakamura_shigeki_line_id = 'U4002d7027f26356aba3fecbb0e00f369';

app.set('port', (process.env.PORT || 8000));
// JSONの送信を許可
app.use(bodyParser.urlencoded({
  extended: true
}));
// JSONのパースを楽に（受信時）
app.use(bodyParser.json());

app.post('/callback', function(req, res) {
  async.waterfall([
      function(callback) {

        console.log(req.body);
        console.log(req.body['events'][0]['message']);

        // リクエストがLINE Platformから送られてきたか確認する
        if (!validate_signature(req.headers['x-line-signature'], req.body)) {
          return;
        }
        // テキストが送られてきた場合のみ返事をする
        if ((req.body['events'][0]['type'] != 'message') || (req.body['events'][0]['message']['type'] != 'text')) {
          return;
        }

        if (req.body['events'][0]['message']['text'].indexOf('助けてほしい人_ビーコン_オン') != -1) {
          console.log('===== 助けてほしい人_ビーコン_オンと入力されました =====');
          request.post(create_push_help_message(global.nakayama_kazuya_line_id, "近くに助けてほしい人がいます"), function(error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body);
            } else {
              console.log('error: ' + JSON.stringify(response));
            }
          });
        } else if (req.body['events'][0]['message']['text'].indexOf('はい、助けます。') != -1) {
          console.log('===== はい、助けます。と入力されました =====');
          request.post(create_push_can_help_message(global.nakamura_shigeki_line_id, "助けてくれる人がみつかりました"), function(error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body);
            } else {
              console.log('error: ' + JSON.stringify(response));
            }
          });
        }
        // 1対1のチャットの場合は相手のユーザ名で返事をする
        // グループチャットの場合はユーザ名が分からないので、「貴様ら」で返事をする
        if (req.body['events'][0]['source']['type'] == 'user') {
          // ユーザIDでLINEのプロファイルを検索して、ユーザ名を取得する
          var user_id = req.body['events'][0]['source']['userId'];
          var get_profile_options = {
            url: 'https://api.line.me/v2/bot/profile/' + user_id,
            json: true,
            headers: {
              'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}'
            }
          };
          request.get(get_profile_options, function(error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body['displayName'] + ':' + user_id);
              callback(create_options(body['displayName'] + ':' + req.body['events'][0]['message']['text'], req.body));
            }
          });
        } else if ('room' == req.body['events'][0]['source']['type']) {
          callback(create_options('グループ' + ':' + req.body['events'][0]['message']['text'], req.body));
        }
      },
    ],
    function(options) {
      request.post(options, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          console.log(body);
        } else {
          console.log('error: ' + JSON.stringify(response));
        }
      });
    }
  );
});

app.listen(app.get('port'), function() {
  console.log('Node app is running');
});

// 署名検証
function validate_signature(signature, body) {
  return signature == crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(new Buffer(JSON.stringify(body), 'utf8')).digest('base64');
}

// LINEの友達に助けてほしいメッセージリクエストを作成
function create_push_help_message(user_id, text) {
  //ヘッダーを定義
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}',
  };

  // 送信データ作成
  var data;
  if (text != null) {
    data = {
      'to': user_id,
      "messages": [{
        'type': "template",
        "altText": "this is a buttons template",
        "template": {
          "type": "confirm",
          "text": text,
          "actions": [{
              "type": "message",
              "label": "Yes",
              "text": "はい、助けます。"
            },
            {
              "type": "message",
              "label": "No",
              "text": "すみません、今は無理です。"
            }
          ]
        }
      }]
    };
  }

  //オプションを定義
  var options = {
    url: 'https://api.line.me/v2/bot/message/push',
    headers: headers,
    json: true,
    body: data
  };

  console.log('===== options =====\n' + options);
  return options;
}

// LINEの助けてくれる友達リストのメッセージリクエストを作成
function create_push_can_help_message(user_id, text) {
  //ヘッダーを定義
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}',
  };

  // 送信データ作成
  var data;
  if (text != null) {
    data = {
      'to': user_id,
      "messages": [{
          'type': "text",
          'text': text
        },
        {
          'type': "template",
          "altText": "this is a buttons template",
          "template": {
            "type": "buttons",
            "text": "助けてほしい人を選んでください",
            "actions": [{
                "type": "postback",
                "label": "中山一哉さん, 男性, 25歳",
                "data": "help_user_id=nakayama"
              },
              {
                "type": "postback",
                "label": "美樹子さん, 女性",
                "data": "help_user_id=mikiko"
              }
            ]
          }
        }
      ]
    };
  }

  //オプションを定義
  var options = {
    url: 'https://api.line.me/v2/bot/message/push',
    headers: headers,
    json: true,
    body: data
  };

  console.log('===== options =====\n' + options);
  return options;
}

// LINEの助けてくれる友達リストのメッセージリクエストを作成
function create_push_can_help_location_message(user_id, text) {
  //ヘッダーを定義
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}',
  };

  // 送信データ作成
  var data;
  if (text != null) {
    data = {
      'to': user_id,
      "messages": [{
          'type': "location",
          "title": user_id + "さんの位置情報",
          "address": "〒261-0014 千葉県千葉市美浜区若葉3丁目１－２１ 幕張neighborhoodPOD",
          "latitude": 35.647885,
          "longitude": 140.046072
        }
      ]
    };
  }

  //オプションを定義
  var options = {
    url: 'https://api.line.me/v2/bot/message/push',
    headers: headers,
    json: true,
    body: data
  };

  console.log('===== options =====\n' + options);
  return options;
}

// LINEに送るリクエストを作成
function create_options(text, body) {
  //ヘッダーを定義
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}',
  };

  // 送信データ作成
  var data;
  if (text != null) {
    data = {
      'replyToken': body['events'][0]['replyToken'],
      "messages": [{
        "type": "text",
        "text": text
      }]
    };
  }

  //オプションを定義
  var options = {
    url: 'https://api.line.me/v2/bot/message/reply',
    headers: headers,
    json: true,
    body: data
  };

  return options;
}

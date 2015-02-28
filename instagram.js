/**
 * Created by pariskshitdutt on 28/02/15.
 */
//var Instagram = require('instagram-node-lib');
//
//Instagram.set('client_id', '33b99d18d174420d8d4f1cdafb6463eb');
//Instagram.set('client_secret', '804d2cea0a5a43ba8f57b51b52f03168');
//var followers_ids=[];
//followers();
//function followers(pagination) {
//    console.log(pagination);
//    Instagram.users.followed_by({
//        user_id: 6302094,
//        cursor:pagination,
//        complete: function (data, pagination) {
//            // data is a javascript object/array/null matching that shipped Instagram
//            // when available (mostly /recent), pagination is a javascript object with the pagination information
//            for(var i=0;i<data.length;i++){
//                followers_ids.push(data[i].id);
//            }
//            console.log(pagination,data.length);
//            followers(pagination.next_cursor);
//
//        },
//        error: function (errorMessage, errorObject, caller) {
//            // errorMessage is the raised error message
//            // errorObject is either the object that caused the issue, or the nearest neighbor
//            // caller is the method in which the error occurred
//            console.log(errorMessage);
//        }
//    });
//}
var EventEmitter = require('events').EventEmitter;
var express=require('express');
var app =express();
app.use(express.static(__dirname + '/public'));
var http = require('http').Server(app);
var io = require('socket.io')(http);

var moment = require('moment');
var ig = require('instagram-node').instagram();
ig.use({ client_id: '0c6beda06dc446b7957d043957314ce7',
    client_secret: '73021c83f4524af294858aa1af12588c' });
var event = new EventEmitter();
var followers=[];
var followercallback = function(err, result, pagination, remaining, limit) {
    // Your implementation here
    //console.log(remaining);
    for(var i=0;i<result.length;i++){
        followers.push(result[i].id);
    }
    event.emit('loading followers',followers.length+" followers fetched");
    if(pagination.next) {
        pagination.next(followercallback); // Will get second page results
    }else{
        completedfollowers();
    }
};
var posts=[];
var max_calls={}
var postscallback = function(err, medias, pagination, remaining, limit) {
    // Your implementation here
    if(!err) {
        for (var i = 0; i < medias.length; i++) {
            posts.push(new Date(parseInt(medias[i].created_time) * 1000));
        }
        event.emit('loading posts',posts.length+" posts fetched");

        if (pagination.next&&max_calls[this.id]<10&&posts.length<5000) {
            if(!max_calls[this.id]){
                max_calls[this.id]=1;
            }else{
                max_calls[this.id]++;
            }
            pagination.next(postscallback.bind({id:this.id})); // Will get second page results
        } else {
            //console.log(this.i);
            completedposts();
        }
    }else{
        console.log(err);
        completedposts();
    }
};
function completedfollowers(){
    console.log(followers.length);
    for(var i=0;i<followers.length;i++) {
        ig.user_media_recent(followers[i],{count:100}, postscallback.bind({id:followers[i]}));
    }

}
function getDetailsofUser(id){
    ig.user_followers(id,{count:100},followercallback);

}
var number=0;
var weekday = new Array(7);
weekday[0]=  "Sunday";
weekday[1] = "Monday";
weekday[2] = "Tuesday";
weekday[3] = "Wednesday";
weekday[4] = "Thursday";
weekday[5] = "Friday";
weekday[6] = "Saturday";
function completedposts(){
    number++;
    console.log(number);
    if(number==followers.length) {
        var post_days={};
        var post_time={};
        for (var i = 0; i < posts.length; i++) {
            if(!post_days[weekday[moment(posts[i]).weekday()]]){
                post_days[weekday[moment(posts[i]).weekday()]]=1;
            }else{
                post_days[weekday[moment(posts[i]).weekday()]]++;
            }
            if(!post_time[posts[i].getHours()]){
                post_time[posts[i].getHours()]=1;
            }else{
                post_time[posts[i].getHours()]++;
            }

        }
        var chartdays=[];
        var bestDay;
        var count=0;
        for(var key in post_days){
            if(post_days[key]>count){
                count=post_days[key];
                bestDay=key;
            }
            chartdays.push({day:key,count:post_days[key]});
        }
        var charttime=[];
        count=0;
        var bestTime;
        for(var key in post_time){
            if(post_time[key]>count){
                count=post_time[key];
                bestTime=key;
            }
            charttime.push({time:key,count:post_time[key]});
        }
        console.log(chartdays);
        console.log(charttime);
        event.emit('done',{days:chartdays,time:charttime,best:bestDay+" at "+bestTime+" hours"});
    }
}
app.get('/', function(req, res){
    res.sendFile(__dirname +'/index.htm');
});
io.on('connection', function(socket){
    console.log("user connected");
    event.on('done',function(data){
        io.emit('init',data);
    });
    event.on('loading posts',function(data){
        io.emit('loading posts',data);
    });
    event.on('loading followers',function(data){
        io.emit('loading followers',data);
    });
   socket.on('instagram id',function(id){
       console.log(id);
       number=0;
       posts=[];
       max_calls={};
       followers=[];

       getDetailsofUser(id);
   })
});
http.listen(3000, function(){
    console.log('listening on *:3000');
});

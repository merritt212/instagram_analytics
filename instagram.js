/**
 * Created by pariskshitdutt on 28/02/15.
 */

/**
 * imports
 */

var EventEmitter = require('events').EventEmitter;
var express=require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var moment = require('moment');
var ig = require('instagram-node').instagram();

/**
 * express app made and an event emitter used for managing different events
 */
var app =express();
var event = new EventEmitter();

/**
 * instagram client_id and secret
 */
ig.use({ client_id: '0c6beda06dc446b7957d043957314ce7', client_secret: '73021c83f4524af294858aa1af12588c' });

/**
 * global variables
 */
var port=5000           //port on which the service will run
var followers=[];       //store all the ids of the followers
var posts=[];           //store the timestamp of all the posts
var max_calls={};       //max_calls used for managing that too many pages are not crawled per follower
var max_posts=5000;     //to prevent fetching too many posts limit on the number of posts to 5000
var number=0;           //keep track of the number of follower data crawled
var weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];     //required to sort data according to day string

/**
 * callback for the followers call used in self repeating loop to fetch all followers
 * @param err
 * @param result
 * @param pagination
 * @param remaining
 * @param limit
 */
var followercallback = function(err, result, pagination, remaining, limit) {
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

/**
 * callback for the posts call and used in self repeating loop so that all posts are fetched the max_posts value to get maximum of 5000 posts so that too many posts are not crawled
 * @param err
 * @param medias
 * @param pagination
 * @param remaining
 * @param limit
 */
var postscallback = function(err, medias, pagination, remaining, limit) {
    if(!err) {
        for (var i = 0; i < medias.length; i++) {
            posts.push(new Date(parseInt(medias[i].created_time) * 1000));
        }
        event.emit('loading posts',posts.length+" posts fetched");

        if (pagination.next&&max_calls[this.id]<10&&posts.length<max_posts) {
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
/**
 * called when the crawling of followers is completed this starts the crawling for posts by the followers
 */
function completedfollowers(){
    console.log(followers.length);
    for(var i=0;i<followers.length;i++) {
        ig.user_media_recent(followers[i],{count:100}, postscallback.bind({id:followers[i]}));
    }

}

/**
 * called on completion of crawl of the posts
 */
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

/**
 * call to start the crawling process
 * @param id
 */
function getDetailsofUser(id){
    ig.user_followers(id,{count:100},followercallback);
}

/**
 * express route to ender the index.htm file
 */
app.get('/', function(req, res){
    res.sendFile(__dirname +'/index.htm');
});

/**
 * socket.io events to send and recieve data to the client side
 */
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
http.listen(port, function(){
    console.log('listening on *:'+port);
});

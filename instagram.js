/**
 * Created by pariskshitdutt on 28/02/15.
 */

/**
 * imports
 */

var EventEmitter = require('events').EventEmitter;
var express=require('express');
var moment = require('moment');
var ig = require('instagram-node').instagram();

/**
 * express app made and an event emitter used for managing different events
 */
var app =express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var event = new EventEmitter();

/**
 * instagram client_id and secret
 */
ig.use({ client_id: '0c6beda06dc446b7957d043957314ce7', client_secret: '73021c83f4524af294858aa1af12588c' });

/**
 * global variables
 */
var port=5000           //port on which the service will run
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
    if(err){
        this.res.json({error:"wrong id"})
        return;
    }

    for(var i=0;i<result.length;i++){
        this.followers.push(result[i].id);
    }
    if(pagination.next) {
        pagination.next(followercallback.bind({user_id:this.user_id,followers:this.followers,posts:this.posts,res:this.res})); // Will get second page results
    }else{
        completedfollowers(this.followers,this.posts,this.user_id,this.res);
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
            this.posts.push(new Date(parseInt(medias[i].created_time) * 1000));
        }

        if (pagination.next) {
            pagination.next(postscallback.bind({id:this.id,posts:this.posts,number:this.number,user_id:this.user_id,res:this.res})); // Will get second page results
        } else {
            //console.log(this.i);
            if(this.number==this.total)
            completedposts(this.posts,this.user_id,this.res);
        }
    }else{
        console.log(err);
        if(this.number==this.total)
            completedposts(this.posts,this.user_id,this.res);
    }
};
/**
 * called when the crawling of followers is completed this starts the crawling for posts by the followers
 */
function completedfollowers(followers,posts,user_id,res){
    console.log("followers completed "+this.user_id,followers.length);
    for(var i=0;i<followers.length;i++) {
        ig.user_media_recent(followers[i],{count:100}, postscallback.bind({id:followers[i],total:(followers.length-1),posts:posts,number:i,user_id:user_id,res:res}));
    }

}

/**
 * called on completion of crawl of the posts
 */
function completedposts(posts,user_id,res){
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
        res.json({days:chartdays,time:charttime,best:bestDay+" at "+bestTime+" hours"});
        //res.end();
}

/**
 * call to start the crawling process
 * @param id
 */
function getDetailsofUser(id,followers,posts,res){
    ig.user_followers(id,{count:100},followercallback.bind({user_id:id,followers:followers,posts:posts,res:res}));
}

function getuserid(name,followers,posts,res){
    //var number=0;
    //var posts=[];
    //var followers=[];
    ig.user_search(name, function(err, users, remaining, limit) {
        var found=false;
            for (var i = 0; i < users.length; i++) {
                if(name==users[i].username){
                    getDetailsofUser(users[0].id,this.followers,this.posts,this.res);
                    found=true;
                }
            }
        if(!found)
        res.json({error:"no such user"})

    }.bind({followers:followers,posts:posts,res:res}));

}

/**
 * express route to ender the index.htm file
 */
app.get('/', function(req, res){
    res.sendFile(__dirname +'/index.htm');
});

app.get('/instagram/:id',function(req,res){
    console.log(req.params.id);
    var followers=[];       //store all the ids of the followers
    var posts=[];           //store the timestamp of all the posts
    req.socket.setTimeout(Infinity);
    getDetailsofUser(req.params.id,followers,posts,res);

});
app.get('/instagram/name/:name',function(req,res){
    console.log(req.params.id);
    var followers=[];       //store all the ids of the followers
    var posts=[];           //store the timestamp of all the posts
    req.socket.setTimeout(Infinity);
    getuserid(req.params.name,followers,posts,res);

})

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
   event.on("no such user",function(){
        io.emit("no user");
   });
   socket.on('username',function(name){
        console.log(name);
        getuserid(name);
   });
   socket.on('instagram id',function(id){
       console.log(id);
       getDetailsofUser(id);
   });
});
http.listen(port, function(){
    console.log('listening on *:'+port);
});

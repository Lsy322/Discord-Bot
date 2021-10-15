
const Discord = require("discord.js");
const { Application } = require("opusscript");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const { MongoClient } = require('mongodb');
require("dotenv").config()

const prefix = "!"
const client = new Discord.Client();
var retryFlag = false;
var retryCount = 0;

const queue = new Map();

var listplayVal = 3

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue, 0);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}queue`)) {
    checkQueue(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}rq`)) {
    removeQueue(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}listplay`)) {
    listplay(message, serverQueue, 0);
    return;
  } else if (message.content.startsWith(`${prefix}top`)) {
    nextQueue(message, serverQueue)
    return;
  } else if (message.content.startsWith(`${prefix}setLV`)) {
    setListplayValue(message)
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

function setListplayValue(message){
  const args = message.content.split(" ");
  listplayVal = parseInt(args[1]);
  message.channel.send(`Amount of Listplay Songs is set to ${listplayVal}`);
}

async function listplay(message, sQ, index){
  for (let index = 0; index < listplayVal; index++) {
    try {
      const serverQueue = queue.get(message.guild.id);
      await execute(message,serverQueue, index)
    } catch (error) {
      console.log(error)
    } 
  }
}

async function execute(message, serverQueue, index) {

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  const args = message.content.split(" ");
  var searchkey = args[1]
  for (let index = 2; index < args.length; index++) {
    searchkey += ' ' + args[index] 
  }
  const args2 = searchkey.split('&')
  searchkey = args2[0]
  console.log(searchkey)
  
    const result = await yts.search(searchkey)
    const video = result.videos[index]

    const song = {
        title: video.title,
        url: video.url,
    };
  

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }
}


function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
    
  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");
    
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  retryFlag = false;
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url,{filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1<<25 }))
    .on("finish", () => {
      serverQueue.songs.shift();
      console.log(serverQueue.songs[0])
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => {
      retryFlag = true;
      if(retryCount < 15){
        console.error(error)
        console.log("\nRETRYING :\n")
        retryCount++;
        setTimeout(play,1000,guild, serverQueue.songs[0])
      }else{
        console.log("\n Reaches Maximum of Retry \n")
        serverQueue.textChannel.send(`Error occur...Please Play Again`);
        serverQueue.voiceChannel.leave();
        retryCount = 0;
      }
    })
  if (retryCount < 1){
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
  }
}

function checkQueue(message, serverQueue) {
  if (!serverQueue)
    return message.channel.send("There is no song in the queue");
    var text = `Songs in the queue:\n`;
   for (var i = 1; i < serverQueue.songs.length; i++) {
       text += `${i}. ${serverQueue.songs[i].title}\n`;
   }
    serverQueue.textChannel.send(text);
}

function removeQueue(message, serverQueue) {
    const key = message.content.split(" ");
    if (!serverQueue)
    return message.channel.send("There is no such index in the queue");
    if (parseInt(key[1]) == serverQueue.songs.length - 1) serverQueue.songs.pop();
    else {
        for (var index = parseInt(key[1]); index < serverQueue.songs.length - 1; index++) {
          serverQueue.songs[index] = serverQueue.songs[index + 1];
        }
        serverQueue.songs.pop()
    }
    serverQueue.textChannel.send(`**${target.title}** have been removed from the queue`);
}

function nextQueue(message, serverQueue) {
  const key = parseInt(message.content.split(" ")[1]);
  var target = serverQueue.songs[key]
  for (let index = key; index > 1; index--) {
    serverQueue.songs[index] = serverQueue.songs[index - 1]
  }
  serverQueue.songs[1] = target
  serverQueue.textChannel.send(`**${target.title}** have been moved to the top of the queue`);
}

client.login(process.env.BOT_TOKEN);

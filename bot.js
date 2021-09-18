
const Discord = require("discord.js");
const ytdl = require("ytdl-core");
require("dotenv").config()

const prefix = "!"
const client = new Discord.Client();

const queue = new Map();

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

  if (message.content.startsWith(`!play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`!skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`!stop`)) {
    stop(message, serverQueue);
    return;
  } else if (message.content.startsWith(`!queue`)) {
    checkQueue(message, serverQueue);
    return;
  } else if (message.content.startsWith(`!rq`)) {
    removeQueue(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

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

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
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
  const serverQueue = queue.get(guild.id);
  if (!song) {
    //serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Start playing: **${song.title}**`);
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
    if (key[1] == serverQueue.songs.length - 1) serverQueue.songs.pop();
    else {
        for (let index = key[1]; index < serverQueue.songs.length - 1; index++) {
            serverQueue.songs[index] = serverQueue.songs[index + 1];
        }
        serverQueue.songs.pop();
        console.log(serverQueue.songs);
    }
    serverQueue.textChannel.send(`Song with index ${key[1]} have been removed from the queue`);
}

client.login(process.env.BOT_TOKEN);
.listen(process.env.PORT || 5000)

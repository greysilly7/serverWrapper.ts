const thisModule = 'discord'

// Import core packages
const properties = require('properties');
const discordjs = require("discord.js");
const modul = new [require('./modul.js')][0](thisModule);



// Set defaults
const discord = new discordjs.Client();
let sS = {} // serverSettings
let mS = {} // moduleSettings
let managementChannels = []; // This will be assigned the management channel when the server starts
let chatChannel = null; 
let discordData = "";
let flatMessages = {};

let awaitResponseFrom = {};

let fn = {
	init: async message => {
		[sS, mS] = modul.loadSettings(message)
		await openDiscord();
		modul.event.on('serverStdout', message => serverStdout(message))
		modul.event.on('consoleStdout', message => {
			if (managementChannels.length > 0) managementChannels.forEach(channel => {
				let match = message.match(/.{1,1999}/g);
				if (match) match.map(async msg => {
					channel.send(`[BOX] > ${msg}\n`, { split: true })
				})
			})
		})
		modul.event.on('serverEvent', event => {
			if (chatChannel && mS.chatLink.enabled) {
				event.filled.embed.color = discord.color
				chatChannel.send({ content: event.filled.text, embed: event.filled.embed })
			}
		})
	},
	discordStdin: async message => {
		if (message.channel) await discord.channels.get(message.channel).send(message.msg)
	},
	addTempManagementChannel: async channel => {
		if (mS.managementChannels.indexOf(channel) == -1) {
			let managementChannel = discord.channels.get(channel)
			managementChannels.push(managementChannel);
			setTimeout(() => managementChannels.pop(managementChannel), 500)
		}
	},
	getResponse: async args => {
		let {user, channel, validResponses, timeout} = args;
		console.log(user, channel, validResponses, timeout)
		let validResponses2 = validResponses.map(x=>x.toUpperCase())
		return await getUserResponse(channel, timeout, user, validResponses2)
	}
}

// Module command handling
process.on('message', async message => {
	switch (message.function) {
		case 'execute':
			if (!(message.func in fn)) modul.reject(new Error(`Command ${message.func} does not exist in module ${thisModule}`), message.promiseId, message.returnModule)
			fn[message.func](message.data)
			.then(data => modul.resolve(data, message.promiseId, message.returnModule))
			.catch(err => modul.reject(err, message.promiseId, message.returnModule))
			break;
		case 'pushSettings':
			[sS, mS] = modul.loadSettings(message)
			break;
	}
});

async function openDiscord() {
	// Fetch discordToken to use and display it at launch
	console.log(`Using Discord Token: ${sS.c[sS.modules['discord'].color].c}${mS.discordToken}${sS.c['reset'].c}`);
	await discord.login(mS.discordToken);
	discord.color = (await modul.call('color', 'getColor', discord.user.avatarURL)).int
}

// On discord client login
discord.on('ready', () => {
	mS.managementChannels.forEach(mChannelId => managementChannels.push(discord.channels.get(mChannelId)))
	if (mS.chatLink.channelId) chatChannel = discord.channels.get(mS.chatLink.channelId);
	properties.parse('./server.properties', {path: true}, (err, properties) => {
		if (err) modul.lErr(err);
		else discord.user.setActivity(properties.motd.replace(/§./g, '').replace(/\n.*/g, '').replace('// Von Spookelton - ', '').replace(' \\\\', ''), { type: 'WATCHING' })
	});
})

// On receive message from discord server
discord.on('message', async message => {
	if (message.author.id == discord.user.id) return;
	if (mS.chatLink.enabled && message.channel.id == chatChannel.id) {
		let msg = JSON.stringify(mS.chatLink.discordToMCFormat)
		.replace("%username%", ((message.author||{}).username)||"Unknown User")
		.replace("%message%", message.toString().trim())
		return await modul.call('serverWrapper', 'serverStdin', `/tellraw @a ${msg}\n`);
	}
	if (mS.managementChannels.indexOf(message.channel.id) == -1 && !message.isMemberMentioned(discord.user)) return;
	let discordMessage = {
		channel : {
			id: ((message.channel||{}).id||null),
			name: ((message.channel||{}).name||null),
			calculatedPosition: ((message.channel||{}).calculatedPosition||null),
			type: ((message.channel||{}).type||null)
		},
		user: {
			id: ((discord.user||{}).id||null),
			username: ((discord.user||{}).username||null),
			avatar: ((discord.user||{}).avatar||null),
			avatarURL: ((discord.user||{}).avatarURL||null)
		},
		author: {
			//user: ((message.author||{})),
			id: ((message.author||{}).id||null),
			username: ((message.author||{}).username||null),
			avatarURL: ((message.author||{}).avatarURL||null)
		},
		member: {
			roles: (((message.member||{}).roles||new discordjs.Collection()).array()||null)
		},
		mentions: {
			users: (((message.mentions||{}).users||new discordjs.Collection()).map(function(mentionedUser) {
				return {
					id: ((mentionedUser||{}).id||null),
					username: ((mentionedUser||{}).username||null),
					avatar: ((mentionedUser||{}).avatar||null),
					avatarURL: ((mentionedUser||{}).avatarURL||null)
				};
			})||null),
			roles: (((message.mentions||{}).roles||new discordjs.Collection()).map(function(mentionedRole) {
				return {
					id: ((mentionedRole||{}).id||null),
					name: ((mentionedRole||{}).name||null),
					color: ((mentionedRole||{}).color||null)
				};
			})||null),
			channels: (((message.mentions||{}).channels||new discordjs.Collection()).map(function(mentionedChannel) {
				return {
					id: ((mentionedChannel||{}).id||null),
					name: ((mentionedChannel||{}).name||null),
					calculatedPosition: ((mentionedChannel||{}).calculatedPosition||null),
					type: ((mentionedChannel||{}).type||null)
				};
			})||null),
			everyone: (((message.mentions||{}).everyone||new discordjs.Collection()).array()||null),
		}
	}
	if (message.isMemberMentioned(discord.user)) discordMessage.string = message.toString().trim().slice(message.toString().trim().indexOf(' ')+1, message.toString().trim().length)
	else discordMessage.string = message.toString().trim();
	if (discordMessage.string) modul.emit('discordMessage', discordMessage)
	if(chatChannel && discordMessage.channel.id === mS.chatLink.chatChannelId) {
		// modul.pSend(process, {
		// 	function: 'serverStdin',
		// 	string: `/say ${discordMessage.user.username}: ${discordMessage.string}`
		// });
	}
	/*if (message.toString() == '^') {
		message.channel.send(`
		${"```"}javascript
		parentObject: {
			childObject: {
				childTitle: 'Blah'
			}
		}${"```"}`, { split: true }).then(responseMessage => {
			responseMessage.react('⬆');
			responseMessage.react('⬇');

			let reactFilter = (reaction, user) => reaction.emoji.name === '⬆' || ;
			responseMessage.awaitReactions(reactFilter, {time: 5000}).then(reactions => {
				debug((reactions.first().name == '⬆') + 'up')
				debug((reactions.first().name == '⬇') + 'down')
			});
		})
	}*/
})

async function serverStdout(string) {
	// every message we send spawns another stdout, so we don't want to infinite loop
	if (string == "50\n") return;
	if (string.indexOf('DiscordIntegration') > -1) return;
	let trueString = string.split('\n')
	for (let i = 0; i < trueString.length - 1; i++) {
		flatMessages[trueString[i]+'\n'] = flatMessages[trueString[i]+'\n'] || 0;
		flatMessages[trueString[i]+'\n']++;
	}

	setTimeout(() => {
		if (flatMessages != {}) {
			for (message in flatMessages) {
				if (flatMessages[message] > 1) discordData += `**${flatMessages[message]}x** ${message}`;
				else discordData += message;
				delete flatMessages[message];
			}
			if (discordData != "" && managementChannels.length > 0) {
				managementChannels.forEach(channel => {
					channel.send(discordData, { split: true })
				})
				discordData = "";
			}
		}
	}, mS.messageFlushRate)
}

async function getUserResponse(channel, timeout, user, validResponses) {

	awaitResponseFrom[user] = validResponses
	cleared = false;

	return new Promise((resolve, reject) => {

		let responseTimeout = setTimeout(() => {
			if (cleared) return; //You can NEVER be too safe
			delete awaitResponseFrom[user];
			resolve("TIMEOUT");
		}, timeout*1000)

		//User response handling
		discord.on("message", async message => {
			//If nothing to wait for, return
			if (awaitResponseFrom.length <= 0 || message.channel.id != channel) return;
			//For every entry in the table thingy
			for (let [k, v] of Object.entries(awaitResponseFrom)) {
				//Message author matches wanted author
				if (message.author.id == k) {
					//For every valid response
					if (v.includes(message.content.toUpperCase().trim())) {
						console.log("MATCH at "+message.content.toUpperCase())
						cleared = true
						clearTimeout(timeout)
						resolve(message.content.toUpperCase())
						delete awaitResponseFrom[user]
						return;
					} else console.log("no match :(")
					/*v.forEach((t, i) => {
						console.log("now at: " + t, i)
						//If response = valid response
						if (message.content.toLowerCase().trim() == t.toLowerCase().trim()) {
							console.log("MATCH")
							cleared = true;
							clearTimeout(responseTimeout)
							resolve(t)
							delete awaitResponseFrom[user]
							return;
						} else console.log(message.content + " is not a match with " + t)
					})*/
					resolve("INVALID")
				}
			}
		})
	})

}
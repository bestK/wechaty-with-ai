import { ChatGPTAPI } from 'chatgpt';
import dotenv from 'dotenv';
import { FileBox } from 'file-box';
import * as FS from 'fs';
import { Configuration, OpenAIApi } from 'openai';
import qrcodeTerminal from 'qrcode-terminal';
import { WechatyBuilder } from 'wechaty';
import { PuppetPadlocal } from "wechaty-puppet-padlocal-unofficial";
import BingDrawClient from './plugin/bing-draw.js';
import { code_innerpeter_run } from './plugin/code-inerpeter.js';
import { KEYWORDS } from './plugin/definevar.js';
import './plugin/global.js';
import { midjourney, text2ImageStableDiffusion } from "./plugin/image.js";
import { askDocument, deleteAllVector, loadDocuments, supportFileType } from './plugin/langchain.js';
import { getMermaidCode, renderMermaidSVG } from './plugin/mermaid.js';
import { getMp3Url } from './plugin/neteasecloudmusicapi.js';
import { keyProvider } from './plugin/openaikey.js';
import { hasChinese, imageMessage, pluginSogouEmotion, promptToCommand, retry, saveFile, silkDecoder, silkEncoder, splitStringByLength, transToEnglish, videoMessage } from './plugin/utils.js';
import { text2VideoByStableDiffusion } from "./plugin/video.js";
import { hackByteDanceTTS, setHackRole } from './plugin/voice.js';
import { browerGetHtml, chatWithHtml, duckduckgo, extractURL } from './plugin/webbrowser.js';

dotenv.config();

const chatgpt = new ChatGPTAPI({
  apiKey: random(await keyProvider()),
  completionParams: { model: 'gpt-3.5-turbo-16k' },
  maxModelTokens: 2048
})

const openai = new OpenAIApi(new Configuration({
  apiKey: random(await keyProvider()),
}));


let currentAdminUser = false

const conversationPool = new Map();

const wechaty = WechatyBuilder.build({
  name: 'wechaty-chatgpt',
  puppet: new PuppetPadlocal({
    token: process.env.PADLOCAL_TOKEN,
  })
});

wechaty
  .on('scan', async (qrcode, status) => {
    qrcodeTerminal.generate(qrcode, { small: true }); // 在console端显示二维码
    const qrcodeImageUrl = ['https://api.qrserver.com/v1/create-qr-code/?data=', encodeURIComponent(qrcode)].join('');
    console.log(qrcodeImageUrl);
  })
  .on('login', user => {
    console.log(`User ${user} logged in`)
  }
  )
  .on('logout', user => console.log(`User ${user} has logged out`))
  .on('room-invite', async roomInvitation => {
    try {
      // 自动通过群聊邀请
      console.log(`received room-invite event.`);
      await roomInvitation.accept();
    } catch (e) {
      console.error(e);
    }
  })
  .on('room-join', async (room, inviteeList, inviter, date) => {
    console.log('received room-join event ');
  })
  .on('friendship', async friendship => {
    try {
      console.log(`received friend event from ${friendship.contact().name()}, messageType: ${friendship.type()}`);
    } catch (e) {
      console.error(e);
    }
  })
  .on('message', async message => {
    let target
    try {
      await retry(async () => {
        const referMessagePayload = message.payload?.referMessagePayload
        if (referMessagePayload) {

          const referMessage = await getRefMsgFileBox(referMessagePayload)

          console.log(JSON.stringify(referMessage))

        }

        if (message.self()) {
          // Don't deal with message from yourself.
          return
        }

        const contact = message.talker();
        currentAdminUser = contact.payload.alias === process.env.ADMIN
        let content = message.text().trim();
        const room = message.room();
        target = room || contact;
        const isText = message.type() === wechaty.Message.Type.Text;
        const isAudio = message.type() === wechaty.Message.Type.Audio;
        const isFile = message.type() === wechaty.Message.Type.Attachment;

        if (isFile) {
          const filebox = await message.toFileBox()
          if (supportFileType(filebox.mediaType)) {
            await saveFile(filebox)
            await deleteAllVector(process.env.PINECONE_INDEX)
            await loadDocuments(process.env.PINECONE_INDEX)
            await send(room || contact, `${filebox.name} Embeddings 成功`)
            return
          }
        }

        const topic = target.topic ? await target.topic() : 'none';

        if (!isAudio && !isText) {
          return;
        }

        console.log(`👂 onMessage group:${topic} contact:${contact.payload.name} ${contact.payload.alias} content: ${content}`);

        if (isAudio) {
          // 解析语音转文字
          try {
            const audioFileBox = await message.toFileBox()
            const mp3 = await silkDecoder({ base64: await audioFileBox.toBase64() })
            await mp3.toFile(mp3.name)
            const response = await openai.createTranscription(FS.createReadStream(mp3.name), 'whisper-1')
            content = response?.data?.text.trim()
            FS.unlinkSync(mp3.name)
          } catch (error) {
            console.error(`💥createTranscription has error: `, error)
            return;
          }

        }

        if (room) {
          const isMentionMe = await message.mentionSelf()
          if (isMentionMe) {
            content = await message.mentionText()
            await reply(target, content);
          }
        } else {
          await reply(target, content);
        }
      })
    } catch (error) {
      await wechaty.say(`❌❌❌\n${message}\n${error.stack}`);
      await send(target, "啊啊啊 出了点小毛病，你再试一下吧");
      console.error(`❌ onMessage: ${error} ${error.stack} \n log send self done.`)
    }

  });

await wechaty
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch(e => console.error(e));
await wechaty.ready();

async function getRefMsgFileBox(payload) {
  try {
    return await wechaty.puppet.messageFile(payload.svrid);
  } catch (error) {
    return null
  }
}

async function reply(target, content) {
  if (!content) {
    console.log(`🗅 empty message`)
    return
  }

  if (currentAdminUser && content === 'ding') {
    await send(target, 'dong');
    return
  }

  let prompt = content

  const url = extractURL(prompt)
  if (url) {
    const html = await browerGetHtml(url)
    prompt = prompt.replace(url, '')
    const res = await chatWithHtml(chatgpt, html, prompt)
    await send(target, res)
    return
  }


  let hitCommand = false
  let userCommand = null

  if (prompt.startsWith("/")) {
    userCommand = prompt.split(' ')[0].trim()
    const commands = KEYWORDS.map(keyword => keyword.command);
    hitCommand = commands.includes(userCommand)
    prompt = (hitCommand ? prompt.replace(userCommand, '') : prompt).trim();
  } else {
    const result = await promptToCommand(prompt, KEYWORDS, openai)
    if (result.command) {
      hitCommand = true
      prompt = result.prompt
      userCommand = result.command
    }
  }

  if (!hitCommand) {
    await chatgptReply(target, prompt);
    return
  }

  if (hitCommand) {
    console.log(`🧑‍💻 onCommand or admin contact:${target} command:${userCommand} content: ${content}`);
    switch (userCommand) {
      case '/表情包':
        await send(target, await pluginSogouEmotion(prompt))
        break;
      case '/enable':
        if (!currentAdminUser) {
          await send(target, '你无权操作此命令')
          break;
        }

        const temp_ai = prompt
        if (!api_map.hasOwnProperty(temp_ai)) {
          await send(target, `${temp_ai} not found`)
          break;
        }
        defaultAI = temp_ai
        await send(target, `ok ${defaultAI}`)
        break;
      case '/画图':
        if (hasChinese(prompt)) {
          prompt = await transToEnglish(prompt);
        }
        let client = new BingDrawClient({
          userToken: process.env.BING_COOKIE,
          baseUrl: `https://${process.env.BING_HOST}`
        })
        await client.getImages(prompt, target)
        break
      case '/mj':
        await send(target, imageMessage(await midjourney(prompt, target)))
        break
      case '/sd':
        await send(target, imageMessage(await text2ImageStableDiffusion(prompt)))
        break
      case '/video':
        await send(target, videoMessage(await text2VideoByStableDiffusion(prompt)))
        break
      case '/doc':
        const res = await askDocument(prompt);
        await send(target, res)
        break;
      case '/speech':
        // const { data, addition } = await getByteDanceTTS(prompt)
        const { data, voice_ms } = await hackByteDanceTTS(prompt)
        const sil = FileBox.fromBase64(data, `${new Date().getTime()}.sil`)
        sil.metadata = {
          voiceLength: voice_ms
        };
        await send(target, sil)
        break;
      case '/search':
        const searchResult = await duckduckgo(prompt)
        if (searchResult) {
          const res = await chatWithHtml(chatgpt, searchResult, prompt);
          await send(target, res)
        }
        break;

      case '/流程图':
        const code = await getMermaidCode(chatgpt, prompt)
        const svg = renderMermaidSVG(code)
        await send(target, svg)
        const editUrl = `https://mermaid-js.github.io/mermaid-live-editor/#/edit/${svg.remoteUrl.split('https://mermaid.ink/img/')[1]}`
        await send(target, `在线编辑:${editUrl}`)
        break;
      case '/song':
        const mp3 = { "url": await getMp3Url(prompt) } // or payload = {"base64":"..."}
        console.log(mp3)
        const mp3Message = await silkEncoder(mp3, 59)

        await send(target, mp3Message)
        break;
      case '/ci':
        const { content, files } = await code_innerpeter_run(prompt)
        await send(target, content)
        if (files) {
          for (let index = 0; index < files.length; index++) {
            const { name, content } = files[index];
            await send(target, FileBox.fromBase64(content, name));
          }
        }
        break;
      case '/role':
        await send(target, setHackRole(prompt))
        break;
      case '/help':
        let helpText = KEYWORDS.map(keyword => `${keyword.command}   ${keyword.desp}`).join(`\n${'-'.repeat(20)}\n`);
        helpText = helpText.concat(`\n${'-'.repeat(20)}\n 你也可以直接通过自然语言触发以上命令与我对话`)
        await send(target, helpText)
        break;
      default:
        await chatgptReply(target, prompt);
        break;
    }
  }

}

async function chatgptReply(target, prompt) {

  let opts = {};
  // conversation
  let conversation = conversationPool.get(target.id);
  if (conversation) {
    opts = conversation;
  }
  opts.timeoutMs = 2 * 60 * 1000;
  let res = { text: "" }
  try {
    res = await chatgpt.sendMessage(prompt, opts);
  } catch (error) {
    res.text = error.message
  }

  const response = res.text;
  console.log(`👽️ contact: ${target} response: ${response}`);
  conversation = {
    conversationId: res.conversationId,
    parentMessageId: res.id,
  };
  conversationPool.set(target.id, conversation);

  const voiceReply = Math.random() < 0.5
  if (voiceReply) {
    await reply(target, `/speech ${response}`)
    return
  }

  await send(target, response);
}

async function send(contact, message) {
  try {
    if (typeof message == 'string' && message.length > 2048) {
      const messages = splitStringByLength(message, 2048)
      for (let index in messages) {
        if (index > 3) break
        await contact.say(messages[index]);
      }
      return
    }
    await contact.say(message);
  } catch (e) {
    console.error(e);
  }
}

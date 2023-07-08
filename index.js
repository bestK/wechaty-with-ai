import { BingChat } from 'bing-chat-patch';
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt';
import dotenv from 'dotenv';
import { FileBox } from 'file-box';
import * as PATH from 'path';

import { Configuration, OpenAIApi } from 'openai';
import qrcodeTerminal from 'qrcode-terminal';
import Replicate from "replicate";
import { Readable } from 'stream';
import { WechatyBuilder } from 'wechaty';
import { PuppetPadlocal } from "wechaty-puppet-padlocal";
import BingDrawClient from './plugin/bing-draw.js';
import { askDocument, loadDocuments, supportFileType } from './plugin/langchain.js';
import { getMermaidCode, renderMermaidSVG } from './plugin/mermaid.js';
import { hasChinese, imageMessage, pluginSogouEmotion, runCommand, saveFile, splitStringByLength, textToSpeechUrl, transToEnglish } from './plugin/utils.js';
import { OCR, browerGetHtml, chatWithHtml, duckduckgo, extractURL, screenshot } from './plugin/webbrowser.js';

dotenv.config();

// const api3 = new ChatGPTAPI({
//   apiKey: process.env.OPENAI_API_KEY,
//   apiBaseUrl: process.env.OPENAI_BASE_URL
// });

const api3 = new ChatGPTUnofficialProxyAPI({
  accessToken: process.env.OPENAI_ACCESS_TOKEN,
  apiReverseProxyUrl: 'https://ai.fakeopen.com/api/conversation',
});

const api4 = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  apiBaseUrl: process.env.apiBaseUrl,
});

const api_bing = new BingChat({
  cookie: process.env.BING_COOKIE,
})

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});




const api_map = { "api3": api3, "api4": api4, "api_bing": api_bing }

let currentAI = "api_bing"

let currentAdminUser = false

const conversationPool = new Map();

// const wechaty = WechatyBuilder.build({
//   name: 'wechaty-chatgpt',
//   puppet: 'wechaty-puppet-wechat4u',
//   puppetOptions: {
//     uos: true,
//   },
// });


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
    const contact = message.talker();
    if (contact.id == 'wxid_tr4l3ax1ej0t12') return
    currentAdminUser = contact.payload.alias === process.env.ADMIN
    const receiver = message.listener();
    let content = message.text().trim();
    const room = message.room();
    const target = room || contact;
    const isText = message.type() === wechaty.Message.Type.Text;
    const isAudio = message.type() === wechaty.Message.Type.Audio;
    const isFile = message.type() === wechaty.Message.Type.Attachment;

    if (isFile) {
      const filebox = await message.toFileBox()
      if (supportFileType(filebox.mediaType)) {
        await saveFile(filebox)
        await loadDocuments()
        await send(room || contact, `${filebox.name} Embeddings 成功`)
        return
      }
    }

    const topic = target.topic ? await target.topic() : 'none';
    if (!isAudio && !isText) {
      return;
    }

    console.log(`👂 onMessage group:${topic} contact:${contact.payload.name} ${contact.payload.alias} content: ${content}`);

    if (isAudio && currentAdminUser) {
      // 解析语音转文字
      try {
        // fixed const audio = await message.wechaty.puppet.messageFile(message.payload.id);
        // rawPayload.Content invalid
        // See: https://github.com/wechaty/puppet-wechat4u/blob/71369a09c1134d55fe9e1379b50b619a6c8a24cc/src/puppet-wechat4u.ts#L671
        const rawPayload = await wechaty.puppet.messageRawPayload(message.payload.id)
        const audioFileBox = FileBox.fromStream(
          (await wechaty.puppet.wechat4u.getVoice(rawPayload.MsgId)).data,
          `message-${message.payload.id}-audio.sil`,
        )

        const audioReadStream = Readable.from(audioFileBox.stream);
        audioReadStream.path = 'conversation.wav';
        const response = await openai.createTranscription(audioReadStream, 'whisper-1')
        content = response?.data?.text.trim()
      } catch (error) {
        console.error(`💥createTranscription has error: `, error)
        return;
      }

    }

    if (room) {
      try {
        const self = wechaty.currentUser;
        if (content.includes(`@${self.payload.name}`)) {
          content = content.replace(`@${self.payload.name}`, '').trim();
          await reply(target, content);
        }
      } catch (error) {
        console.error(error)
      }

    } else {
      await reply(target, content);
    }

  });

await wechaty
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch(e => console.error(e));
await wechaty.ready();

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
    const res = await chatWithHtml(api3, html, prompt)
    await send(target, res)
    return
  }


  const keywords = [
    {
      command: '/c',
      desp: 'AI对话，群聊时 @ 即可'
    },
    {
      command: '/表情包',
      desp: '搜狗表情包'
    },
    {
      command: '/enable',
      desp: '切换 AI 接口，需要管理员权限'
    },
    {
      command: '/画图',
      desp: 'bing 画图'
    },
    {
      command: '/mj',
      desp: 'mdjrny-v4 风格的画图'
    },
    {
      command: '/doc',
      desp: '使用 AI 与文档对话，将文档发送至聊天窗口等待返回 embeddings 成功后，即可开始'
    },
    {
      command: '/speech',
      desp: '文字转语音'
    },
    {
      command: '/search',
      desp: '搜索查询互联网内容进行回答'
    },
    {
      command: '/流程图',
      desp: '生成流程图'
    },
    {
      command: '/screenshot',
      desp: 'screenshot 截图'
    },
    {
      command: '/help',
      desp: '帮助信息'
    },

  ]

  let hitCommand = false
  let userCommand = null

  if (prompt.startsWith("/")) {
    userCommand = prompt.split(' ')[0].trim()
    const commands = keywords.map(keyword => keyword.command);
    hitCommand = commands.includes(userCommand)
    prompt = (hitCommand ? prompt.replace(userCommand, '') : prompt).trim();
  } else {
    const nlCommand = await naturalLanguageToCommand(prompt, keywords)
    if (nlCommand.command) {
      hitCommand = true
      prompt = nlCommand.prompt
      userCommand = nlCommand.command
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
        currentAI = temp_ai
        await send(target, `ok ${currentAI}`)
        break;
      case '/画图':
        if (hasChinese(prompt)) {
          prompt = await transToEnglish(prompt);
        }
        let client = new BingDrawClient({
          userToken: process.env.BING_COOKIE,
          baseUrl: `https://${process.env.BING_HOST}`
        })

        try {
          await client.getImages(prompt, target)
        } catch (err) {
          await send(target, '绘图失败：' + err)
        }
        break
      case '/mj':
        // prompt = hasChinese(prompt) ? await transToEnglish(prompt) : prompt
        const output = await replicate.run(
          "prompthero/openjourney:ad59ca21177f9e217b9075e7300cf6e14f7e5b4505b87b9689dbd866e9768969",
          {
            input: {
              prompt: `${prompt}`
            }
          }
        );

        for (let i = 0; i < output.length; ++i) {
          const url = output[i]
          console.log(`🖼️ ${prompt} ${url}`);
          await send(target, imageMessage(url))
        }
        break
      case '/doc':
        const res = await askDocument(prompt);
        await send(target, res)
        break;
      case '/speech':
        let mp3 = await FileBox.fromUrl(await textToSpeechUrl(prompt))
        await mp3.toFile('input.mp3', true)

        const basePath = process.env.MP32SILK_PATH
        const ffmpegCommnd = PATH.join(basePath, `ffmpeg -y -i input.mp3 -acodec pcm_s16le -ar 24000 -ac 1 -f s16le output.pcm`)
        const toSilkCommnd = PATH.join(basePath, `silk_v3_encoder output.pcm output.sil -tencent`)

        await runCommand(ffmpegCommnd)
        await runCommand(toSilkCommnd)
        const sil = await FileBox.fromFile('output.sil')

        sil.metadata = {
          voiceLength: 1000,
        };
        await send(target, sil)
        break;
      case '/search':
        const searchResult = await duckduckgo(prompt)
        if (searchResult) {
          const res = await chatWithHtml(api3, searchResult, prompt);
          await send(target, res)
        }
        break;

      case '/流程图':
        const code = await getMermaidCode(api3, prompt)
        const svg = renderMermaidSVG(code)
        await send(target, svg)
        const editUrl = `https://mermaid-js.github.io/mermaid-live-editor/#/edit/${svg.remoteUrl.split('https://mermaid.ink/img/')[1]}`
        await send(target, `在线编辑:${editUrl}`)
        break;

      case '/screenshot':
        const buffer = await screenshot(prompt)
        console.log(await OCR(buffer))
        await send(target, FileBox.fromBuffer(buffer, `${new Date().getTime()}.png`))
        break;
      case '/help':
        let helpText = keywords.map(keyword => `${keyword.command}   ${keyword.desp}`).join(`\n${'-'.repeat(20)}\n`);
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
  let response = imageMessage('https://img02.sogoucdn.com/app/a/100520021/87DEAE7BAACE15B8CA451FC2645D6B3E', 'gif')
  try {
    let opts = {};
    // conversation
    let conversation = conversationPool.get(target.id);
    if (conversation) {
      opts = conversation;
    }
    opts.timeoutMs = 2 * 60 * 1000;

    const api = api_map[currentAI]

    let res = await api.sendMessage(prompt, opts);
    response = res.text;
    console.log(`👽️ contact: ${target} response: ${response}`);
    conversation = {
      conversationId: res.conversationId,
      parentMessageId: res.id,
    };
    conversationPool.set(target.id, conversation);
  } catch (e) {
    if (e.message === 'ChatGPTAPI error 429') {
      response = '🤯🤯🤯请稍等一下哦，我还在思考你的上一个问题';
    }
    console.error(e);
  }

  const voiceReply = (new Date().getTime() % 10) > 3
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



async function naturalLanguageToCommand(nl, keywords) {
  if (nl.startsWith('/help')) return nl
  const prompt = `根据 
      ### 配置开始
      ${JSON.stringify(keywords)}
      ### 配置结束
      这个配置匹配出用户输入的语句所匹配的命令,并且删除desp与question相同的字,不要加任何解释
      例如 我想画一个汤姆猫 你返回 {"command":"/画图","prompt":"一个汤姆猫"} 
      如果不能匹配你返回  {"command":null,"prompt":" $Question"}

      Question:  ${nl}
      Helpful Answer:
  `

  const { text } = await api3.sendMessage(prompt)
  let command = {}
  try {
    command = JSON.parse(text)
    if (command.command == '/help') {
      command.command = undefined
    }
  } catch (error) {
    console.log(`naturalLanguageToCommand has error:${text} ${error}`)
  }

  return command
}
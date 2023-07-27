import { PineconeClient } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';
import { VectorDBQAChain } from "langchain/chains";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PromptLayerOpenAI } from "langchain/llms/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import * as PATH from 'path';
dotenv.config();

let cachedIndex = {};

let pineconeClient = null;

const getPineconeClient = async () => {
    if (pineconeClient) return pineconeClient;

    pineconeClient = new PineconeClient();
    await pineconeClient.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
    });

    return pineconeClient
}

const getPineconeIndex = async (indexName) => {
    if (cachedIndex[indexName]) {
        // 如果结果已经被缓存，直接返回缓存的值
        return cachedIndex[indexName];
    }

    try {
        const pinecone = await getPineconeClient()
        cachedIndex[indexName] = await pinecone.Index(indexName);
        return cachedIndex[indexName];
    } catch (error) {
        console.log(`PineconeClient has error: ${error}`);
        return null;
    }
}


export const createIndex = async (indexName) => {
    const pinecone = await getPineconeClient()
    indexName = formartIndexName(indexName)

    await pinecone.createIndex({
        createRequest: {
            name: indexName,
            dimension: 128,
        }
    });
}


export const getIndexStatus = async (indexName) => {
    indexName = formartIndexName(indexName)
    const pinecone = await getPineconeClient()
    return await pinecone.describeIndex(indexName);
}

export const deleteAllVector = async (indexName) => {
    const index = await getPineconeIndex(indexName)
    await index.delete1({
        deleteAll: true
    });
}

async function loadDocuments(indexName, directory = 'resource') {
    console.log('loadDocuments...')
    const loader = new DirectoryLoader(directory,
        {
            ".pdf": (path) => new PDFLoader(path),
            ".txt": (path) => new TextLoader(path),
            ".doc": (path) => new DocxLoader(path),
            ".docx": (path) => new DocxLoader(path),
        });
    // 将数据转成 document 对象，每个文件会作为一个 document
    const rawDocuments = await loader.load();
    console.log(`documents: ${rawDocuments.length}`);

    // 初始化加载器
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500 });
    // 切割加载的 document
    const splitDocs = await textSplitter.splitDocuments(rawDocuments);
    const index = await getPineconeIndex(indexName)
    console.log(`sending...`);
    await PineconeStore.fromDocuments(splitDocs, new OpenAIEmbeddings(), {
        pineconeIndex: index
    });
    console.log(`send to PineconeStore.`);

}


async function askDocument(question) {
    const llm = new PromptLayerOpenAI({ plTags: ["langchain-requests", "chatbot"] })

    const index = await getPineconeIndex(process.env.PINECONE_INDEX)
    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings(),
        { pineconeIndex: index }
    );

    const chain = VectorDBQAChain.fromLLM(llm, vectorStore, {
        k: 1,
        returnSourceDocuments: true,
    });
    const response = await chain.call({ query: question });
    console.log(response);
    return response.text
}

function supportFileType(mediaType) {
    const types = ['doc', 'docx', , 'pdf', 'text']
    return types.filter(e => mediaType.includes(e)).length > 0
}

function formartIndexName(indexName) {
    return PATH.basename(indexName, PATH.extname(indexName)).toLowerCase();
}

export { askDocument, loadDocuments, supportFileType };


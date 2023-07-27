export async function code_innerpeter_run(prompt, fileBase64, fileName) {
    const url = " https://b37f-34-23-11-34.ngrok-free.app/run"
    const body = JSON.stringify({ "prompt": prompt, "file_base64": fileBase64, "filename": fileName })
    const api = await fetch(url, { body: body, headers: { "content-type": "application/json" }, method: "post" })

    return await api.json()
}
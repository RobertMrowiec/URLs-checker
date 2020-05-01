const fs = require('fs');
const linkify = require('linkifyjs');
const fetch = require('node-fetch');
const glob = require('glob-fs')({ gitignore: true });
const core = require('@actions/core');

let URLs = []
let urls_length;
let brokenURLsString = ''
let retry = 1
let reachable = 0;
let broken = 0;
let finished = 0;

(async () => {
  const files = glob.readdirSync('**/*.md', {})
  for (let i = 0; i < files.length; i++) {
    const file = fs.readFileSync(files[i], { encoding: 'utf-8' })
    const fileName = files[i].replace(__dirname, '')

    linkify.find(file).filter(url => url.type === 'url' && ( url.value.includes('http') || url.value.includes('www') )).map(urls => URLs.push({
      file: fileName,
      href: urls.value
    }))
  }

  urls_length = URLs.length

  console.log('Finished: 0%')
  return Promise.all(URLs.map(async url => {
    const fileName = url.file.replace('temp/', '')
    url.href = url.href.includes(')') ? url.href.split(')')[0] : url.href
    return fetchUrl(fileName, url)
  })).then(() => {
    console.log('Finished: 100%');
    if (brokenURLsString.length > 0)
      return core.setFailed(`
Number of reachable URLs: ${reachable} \n
Number of broken URLs: ${broken} \n
List of broken URLs: ${brokenURLsString}
      `)
    else
      return core.setOutput(`
All links were checked and they are working
`)
  })
})()

async function fetchUrl(fileName, url) {
  try {
    const response = await fetch(url.href)
    const status = response.ok
    if (!status)
      throw response
    else {
      retry = 1
      reachable++
      finished++
      percentDone(urls_length, finished)
      return
    }
  } catch (response) {
    if (response.code === 'ETIMEDOUT'){
      return
    } else if (retry === 1){
      retry = 0
      return fetchUrl(fileName, url)
    } else {
      retry = 1
      broken++
      url.href.includes('.md') ? broken-- : brokenURLsString += `\n${fileName}:\n${url.href}\n----------`
      return
    }
  }
}

function percentDone(length, actual) {
  let percent;
  const quarter = +(length / 4).toFixed()

  switch (actual) {
    case quarter:
      percent = '25%'
      console.log(`Finished: ${percent}`)
      break
    case quarter * 2:
      percent = '50%'
      console.log(`Finished: ${percent}`)
      break
    case quarter * 3:
      percent = '75%'
      console.log(`Finished: ${percent}`)
      break
  }
}

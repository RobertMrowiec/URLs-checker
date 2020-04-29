const fs = require('fs');
const linkify = require('linkifyjs');
const fetch = require('node-fetch');
const glob = require('glob-fs')({ gitignore: true });
const core = require('@actions/core');

let URLs = []
let brokenURLsString = ''
let retry = 1
let reachable = 0;
let broken = 0;

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

  console.log('Finished: 0%')

  for (url of URLs) {
    const fileName = url.file.replace('temp/', '')
    url.href = url.href.includes(')') ? url.href.split(')')[0] : url.href
    percentDone(URLs, url)
    await fetchUrl(fileName, url)
  }
  console.log('Finished: 100%');
  
  if (brokenURLsString.length > 0)
    return core.setFailed(`
Number of reachable URLs: ${reachable} \n
Number of broken URLs: ${broken} \n
List of broken URLs: ${brokenURLsString}
`)
})()

async function fetchUrl(fileName, url) {
  try {
    const response = await fetch(url.href)
    if (!response.ok)
      throw { response }
    else {
      retry = 1
      reachable++
    }
  } catch (response) {
    if (retry === 1){
      retry = 0
      return fetchUrl(fileName, url)
    } else {
      if (response.code === 'ETIMEDOUT')
        return

      retry = 1
      broken++
      url.href.includes('.md') ? {} : brokenURLsString += `\n${fileName}:\n${url.href}\n----------`
    }
  }
}

function percentDone(all, actual) {
  all = all.map(url => url.href);
  actual = actual.href
  let percent
  const max = all.length
  const quarter = +(max / 4).toFixed()
  const actualPosition = all.indexOf(actual)

  switch (actualPosition) {
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
    case quarter * 4:
      percent = '100%'
      console.log(`Finished: ${percent}`)
      break
    default:
      percent = '0%'
  }
}

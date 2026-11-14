import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import logger from './logger'

export const SNIPPET_PATHS = Object.freeze(['./server.ts', './routes', './lib', './data', './data/static/web3-snippets', './frontend/src/app', './models', './infrastructure'])

interface FileMatch {
  path: string
  content: string
}

interface CachedCodeChallenge {
  snippet: string
  vulnLines: number[]
  neutralLines: number[]
}

export const findFilesWithCodeChallenges = async (paths: readonly string[]): Promise<FileMatch[]> => {
  const matches = []
  for (const currPath of paths) {
    try {
      const relative = path.relative(process.cwd(), path.resolve(currPath))
      if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        continue
      }
      const safePath = path.join(process.cwd(), relative)
      if ((await lstat(safePath)).isDirectory()) {
        const files = await readdir(safePath)
        const moreMatches = await findFilesWithCodeChallenges(
          files.map(file => path.resolve(safePath, file))
        )
        matches.push(...moreMatches)
      } else {
        const code = await readFile(safePath, 'utf8')
        if (
          // strings are split so that it doesn't find itself...
          code.includes('// vuln-code' + '-snippet start') ||
          code.includes('# vuln-code' + '-snippet start')
        ) {
          matches.push({ path: safePath, content: code })
        }
      }
    } catch (e) {
      logger.warn(`File ${currPath} could not be read. It might have been moved or deleted. If coding challenges are contained in the file, they will not be available.`)
    }
  }

  return matches
}

function getCodeChallengesFromFile (file: FileMatch) {
  const fileContent = file.content

  // get all challenges which are in the file by a regex capture group
  const challengeKeyRegex = /[/#]{0,2} vuln-code-snippet start (?<challenges>.*)/g
  const challenges = [...fileContent.matchAll(challengeKeyRegex)]
    .flatMap(match => match.groups?.challenges?.split(' ') ?? [])
    .filter(Boolean)

  return challenges.map((challengeKey) => getCodingChallengeFromFileContent(fileContent, challengeKey))
}

const markerWithKey = (line: string, marker: string, key: string) => {
  const idx = line.indexOf(marker)
  return idx >= 0 && line.indexOf(key, idx + marker.length) >= 0
}

function extractSnippetBlock (source: string, key: string): string | null {
  const lines = source.split('\n')
  let offset = 0
  let startOffset = -1
  let startLine = -1
  let endOffset = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (startLine === -1) {
      if (markerWithKey(line, ' vuln-code-snippet start', key)) {
        startLine = i
        startOffset = offset + line.indexOf(' vuln-code-snippet start')
        let n = 0
        while (n < 2 && startOffset > offset && '/#'.includes(source[startOffset - 1])) {
          startOffset--
          n++
        }
      }
    } else if (markerWithKey(line, ' vuln-code-snippet end', key)) {
      endOffset = offset + line.replace(/\r$/, '').length
    }
    offset += line.length + 1
  }
  if (startLine === -1 || endOffset === -1) return null
  return source.substring(startOffset, endOffset)
}

export function getCodingChallengeFromFileContent (source: string, challengeKey: string) {
  const key = challengeKey
  const block = extractSnippetBlock(source, key)
  if (block == null) {
    throw new BrokenBoundary('Broken code snippet boundaries for: ' + challengeKey)
  }
  const snippets = [block]
  let snippet = snippets[0] // TODO Currently only a single code snippet is supported
  snippet = snippet.replace(/\s?[/#]{0,2} vuln-code-snippet start.*[\r\n]{0,2}/g, '')
  snippet = snippet.replace(/\s?[/#]{0,2} vuln-code-snippet end.*/g, '')
  snippet = snippet.replace(/.*[/#]{0,2} vuln-code-snippet hide-line[\r\n]{0,2}/g, '')
  snippet = snippet.replace(/.*[/#]{0,2} vuln-code-snippet hide-start([^])*[/#]{0,2} vuln-code-snippet hide-end[\r\n]{0,2}/g, '')
  snippet = snippet.trim()

  let lines = snippet.split('\r\n')
  if (lines.length === 1) lines = snippet.split('\n')
  if (lines.length === 1) lines = snippet.split('\r')
  const vulnLines = []
  const neutralLines = []
  for (let i = 0; i < lines.length; i++) {
    if (markerWithKey(lines[i], 'vuln-code-snippet vuln-line', key)) {
      vulnLines.push(i + 1)
    } else if (markerWithKey(lines[i], 'vuln-code-snippet neutral-line', key)) {
      neutralLines.push(i + 1)
    }
  }
  snippet = snippet.replace(/\s?[/#]{0,2} vuln-code-snippet vuln-line.*/g, '')
  snippet = snippet.replace(/\s?[/#]{0,2} vuln-code-snippet neutral-line.*/g, '')
  return { challengeKey, snippet, vulnLines, neutralLines }
}

export class BrokenBoundary extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'BrokenBoundary'
    this.message = message
  }
}

// dont use directly, use getCodeChallenges getter
let _internalCodeChallenges: Map<string, CachedCodeChallenge> | null = null
export async function getCodeChallenges (): Promise<Map<string, CachedCodeChallenge>> {
  if (_internalCodeChallenges === null) {
    _internalCodeChallenges = new Map<string, CachedCodeChallenge>()
    const filesWithCodeChallenges = await findFilesWithCodeChallenges(SNIPPET_PATHS)
    for (const fileMatch of filesWithCodeChallenges) {
      for (const codeChallenge of getCodeChallengesFromFile(fileMatch)) {
        _internalCodeChallenges.set(codeChallenge.challengeKey, {
          snippet: codeChallenge.snippet,
          vulnLines: codeChallenge.vulnLines,
          neutralLines: codeChallenge.neutralLines
        })
      }
    }
  }
  return _internalCodeChallenges
}

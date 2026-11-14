/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'

/**
 * Resolves a file name inside a base directory and rejects anything that
 * would end up outside of it (or in a subdirectory of it).
 */
export function resolveInside (baseDir: string, name: string): string {
  const base = path.resolve(baseDir)
  const resolved = path.resolve(base, path.basename(String(name)))
  if (path.dirname(resolved) !== base) throw new Error('Invalid file name')
  return resolved
}

export const readTextInside = (baseDir: string, name: string): string =>
  fs.readFileSync(resolveInside(baseDir, name), 'utf8')

export const readTextInsideAsync = async (baseDir: string, name: string): Promise<string> =>
  await fsp.readFile(resolveInside(baseDir, name), { encoding: 'utf8' })

export const existsInside = (baseDir: string, name: string): boolean => {
  try {
    return fs.existsSync(resolveInside(baseDir, name))
  } catch {
    return false
  }
}

export const statInside = (baseDir: string, name: string): fs.Stats =>
  fs.statSync(resolveInside(baseDir, name))

export const readStreamInside = (baseDir: string, name: string, options?: { start?: number, end?: number }): fs.ReadStream =>
  fs.createReadStream(resolveInside(baseDir, name), options)

export const writeStreamInside = (baseDir: string, name: string): fs.WriteStream =>
  fs.createWriteStream(resolveInside(baseDir, name), { flags: 'w' })

export const writeFileInside = async (baseDir: string, name: string, data: Buffer | string): Promise<void> => {
  await fsp.writeFile(resolveInside(baseDir, name), data)
}

/** Parses YAML restricted to plain JSON types (no custom tags). */
export const parseYamlSafe = (content: string): any =>
  yaml.load(content, { schema: yaml.JSON_SCHEMA })

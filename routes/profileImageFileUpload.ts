/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'

import logger from '../lib/logger'
import { UserModel } from '../models/user'
import * as security from '../lib/insecurity'
import * as safeFs from '../lib/safeFs'

export function profileImageFileUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file
    const buffer = file?.buffer
    if (buffer === undefined) {
      res.status(500)
      next(new Error('Illegal file type'))
      return
    }
    const uploadedFileType = await (await import('file-type')).fileTypeFromBuffer(buffer)
    if (uploadedFileType === undefined) {
      res.status(500)
      next(new Error('Illegal file type'))
      return
    }
    if (uploadedFileType === null || !uploadedFileType.mime.startsWith('image')) {
      res.status(415)
      next(new Error(`Profile image upload does not accept this file type${uploadedFileType ? (': ' + uploadedFileType.mime) : '.'}`))
      return
    }
    const loggedInUser = security.authenticatedUsers.get(req.cookies.token)
    if (!loggedInUser) {
      next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress))
      return
    }

    const uploadDir = path.resolve('frontend/dist/frontend/assets/public/images/uploads')
    const filePath = path.resolve(uploadDir, path.basename(`${Number(loggedInUser.data.id)}.${uploadedFileType.ext.replace(/[^a-z0-9]/gi, '')}`))
    if (path.dirname(filePath) !== uploadDir) {
      next(new Error('Invalid file path'))
      return
    }
    try {
      await safeFs.writeFileInside(uploadDir, path.basename(filePath), buffer)
    } catch (err) {
      logger.warn('Error writing file: ' + (err instanceof Error ? err.message : String(err)))
    }

    try {
      const user = await UserModel.findByPk(loggedInUser.data.id)
      if (user != null) {
        await user.update({ profileImage: `assets/public/images/uploads/${loggedInUser.data.id}.${uploadedFileType.ext}` })
      }
    } catch (error) {
      next(error)
    }
    res.location(process.env.BASE_PATH + '/profile')
    res.redirect(process.env.BASE_PATH + '/profile')
  }
}

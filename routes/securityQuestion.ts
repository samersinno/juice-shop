/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { SecurityAnswerModel } from '../models/securityAnswer'
import { UserModel } from '../models/user'
import { SecurityQuestionModel } from '../models/securityQuestion'

export function securityQuestion () {
  return async ({ query }: Request, res: Response, next: NextFunction) => {
    const email = query.email
    if (typeof email !== 'string') {
      res.json({})
      return
    }
    try {
      const answer = await SecurityAnswerModel.findOne({
        include: [{
          model: UserModel,
          where: { email: email }
        }]
      })
      if (answer != null) {
        const question = await SecurityQuestionModel.findByPk(answer.SecurityQuestionId)
        res.json({ question })
      } else {
        res.json({})
      }
    } catch (error) {
      next(error)
    }
  }
}

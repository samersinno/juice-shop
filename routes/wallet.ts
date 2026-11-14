/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { WalletModel } from '../models/wallet'
import { CardModel } from '../models/card'

const userId = (req: Request): number => Number(req.body.UserId)

async function findOwnCard (paymentId: unknown, owner: number) {
  if (paymentId == null) return null
  const id = Number(paymentId)
  if (!Number.isInteger(id) || !Number.isInteger(owner)) return null
  return await CardModel.findOne({ where: { id, UserId: owner } })
}

export function getWalletBalance () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const wallet = await WalletModel.findOne({ where: { UserId: userId(req) } })
    if (wallet != null) {
      res.status(200).json({ status: 'success', data: wallet.balance })
    } else {
      res.status(404).json({ status: 'error' })
    }
  }
}

export function addWalletBalance () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const card = await findOwnCard(req.body.paymentId, userId(req))
    if (card != null) {
      try {
        await WalletModel.increment({ balance: Number(req.body.balance) }, { where: { UserId: userId(req) } })
        res.status(200).json({ status: 'success', data: req.body.balance })
      } catch {
        res.status(404).json({ status: 'error' })
      }
    } else {
      res.status(402).json({ status: 'error', message: 'Payment not accepted.' })
    }
  }
}

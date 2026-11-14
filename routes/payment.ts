/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { CardModel } from '../models/card'

async function findCardOfUser (cardId: number, userId: number) {
  return await CardModel.findOne({ where: { id: cardId, UserId: userId } })
}

interface displayCard {
  UserId: number
  id: number
  fullName: string
  cardNum: string
  expMonth: number
  expYear: number
}

function toDisplayCards (cards: CardModel[]): displayCard[] {
  return cards.map(card => {
    const cardNumber = String(card.cardNum)
    return {
      UserId: card.UserId,
      id: card.id,
      fullName: card.fullName,
      cardNum: '*'.repeat(12) + cardNumber.substring(cardNumber.length - 4),
      expMonth: card.expMonth,
      expYear: card.expYear
    }
  })
}

export function getPaymentMethods () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const displayableCards: displayCard[] = []
    const cards = await CardModel.findAll({ where: { UserId: Number(req.body.UserId) } })
    displayableCards.push(...toDisplayCards(cards))
    res.status(200).json({ status: 'success', data: displayableCards })
  }
}

export function getPaymentMethodById () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const card = await findCardOfUser(Number(req.params.id), Number(req.body.UserId))
    const displayableCard: displayCard = {
      UserId: 0,
      id: 0,
      fullName: '',
      cardNum: '',
      expMonth: 0,
      expYear: 0
    }
    if (card != null) {
      displayableCard.UserId = card.UserId
      displayableCard.id = card.id
      displayableCard.fullName = card.fullName
      displayableCard.expMonth = card.expMonth
      displayableCard.expYear = card.expYear

      const cardNumber = String(card.cardNum)
      displayableCard.cardNum = '*'.repeat(12) + cardNumber.substring(cardNumber.length - 4)
    }
    if ((card != null) && displayableCard) {
      res.status(200).json({ status: 'success', data: displayableCard })
    } else {
      res.status(400).json({ status: 'error', data: 'Malicious activity detected' })
    }
  }
}

export function delPaymentMethodById () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const card = await CardModel.destroy({ where: { id: Number(req.params.id), UserId: Number(req.body.UserId) } })
    if (card) {
      res.status(200).json({ status: 'success', data: 'Card deleted successfully.' })
    } else {
      res.status(400).json({ status: 'error', data: 'Malicious activity detected.' })
    }
  }
}

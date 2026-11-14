/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'

import * as challengeUtils from '../lib/challengeUtils'
import { challenges } from '../data/datacache'
import * as security from '../lib/insecurity'
import { type Review } from '../data/types'
import * as db from '../data/mongodb'

const sleep = async (ms: number) => await new Promise(resolve => setTimeout(resolve, ms))

async function findReviewById (reviewId: string) {
  return await db.reviewsCollection.findOne({ _id: reviewId })
}

function countOccurrences (values: string[], value: string) {
  let count = 0
  for (const entry of values) {
    if (entry === value) count++
  }
  return count
}

function reviewIdFrom (body: Record<string, unknown> | undefined) {
  const candidate = body?.id
  return typeof candidate === 'string' && /^[\w-]+$/.test(candidate) ? candidate : null
}

export function likeProductReviews () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = reviewIdFrom(req.body)
    if (id === null) {
      return res.status(400).json({ error: 'Wrong Params' })
    }
    const user = security.authenticatedUsers.from(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
      const review = await findReviewById(id)
      if (!review) {
        return res.status(404).json({ error: 'Not found' })
      }

      const likedBy = review.likedBy
      if (likedBy.includes(user.data.email)) {
        return res.status(403).json({ error: 'Not allowed' })
      }

      await db.reviewsCollection.update(
        { _id: String(id) },
        { $inc: { likesCount: 1 } }
      )

      // Artificial wait for timing attack challenge
      await sleep(150)
      try {
        const updatedReview: Review = await findReviewById(id)
        const updatedLikedBy = updatedReview.likedBy
        updatedLikedBy.push(user.data.email)

        const count = countOccurrences(updatedLikedBy, user.data.email)
        challengeUtils.solveIf(challenges.timingAttackChallenge, () => count > 2)

        const result = await db.reviewsCollection.update(
          { _id: String(id) },
          { $set: { likedBy: updatedLikedBy } }
        )
        res.json(result)
      } catch (err) {
        res.status(500).json(err)
      }
    } catch (err) {
      res.status(400).json({ error: 'Wrong Params' })
    }
  }
}

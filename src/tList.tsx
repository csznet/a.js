import { Context } from "hono";
import { Auth, Config, DB, Pagination } from "./core";
import { TList } from "../render/TList";
import { raw } from "hono/html";

export async function tList(a: Context) {
    const i = await Auth(a)
    const page = parseInt(a.req.query('page') ?? '0') || 1
    const land = await Config.get<number>(a, 'land', true) ?? parseInt(a.req.query('land') ?? '0')
    const page_size_t = await Config.get<number>(a, 'page_size_t') || 20
    const total = await DB.db
        .prepare(`
            SELECT count(*) AS total
            FROM post
            WHERE attr IN (0,1)
            AND `+ (land ? `land` : `call`) + ` = ?
        `)
        .get([land]) ?? 0
    const data = total ? await DB.db
        .prepare(`
            WITH main_post AS (
                SELECT *
                FROM post
                WHERE post.attr IN (0,1)
                AND `+ (land ? `post.land` : `post.call`) + ` = ?
                ORDER BY post.attr DESC, `+ (land ? `post.land` : `post.call`) + ` DESC, post.sort DESC
                LIMIT ?,?
            ),
            last_post AS (
                SELECT MAX(p.sort) AS lp_time, land
                FROM post p
                WHERE p.attr IN (0,1)
                LIMIT 1
            )
            SELECT
                mp.*,
                user.name AS name,
                user.grade AS grade,
                user.credits AS credits,
                lp.lp_time AS last_time
            FROM main_post AS mp
            LEFT JOIN user
                ON user.uid = mp.user
            LEFT JOIN last_post AS lp
                ON lp.land = -mp.pid
        `)
        .all([land, (page - 1) * page_size_t, page_size_t]) : []
    const pagination = Pagination(page_size_t, total, page, 2)
    const title = raw(await Config.get<string>(a, 'site_name', false))
    return a.html(TList(a, { i, page, pagination, data, title }))
}

import { expect, test, type Page } from '@playwright/test';

/**
 * 세로 화면(폰) 회귀 방지.
 *
 * 손패가 46px 고정이라 14장이면 662px, 마작상 안쪽도 전부 고정 px이라 390px
 * 화면에서 대국 화면이 690px로 넘쳤다. 아래 두 가지를 못 박아 둔다.
 *  1) 어느 화면에서도 가로 스크롤이 생기지 않는다
 *  2) 설정·역 일람·기록에 폰에서도 닿을 수 있다 (사이드 패널이 lg 이상에서만 보인다)
 */

const PHONE = { width: 390, height: 844 };
const SMALL = { width: 320, height: 568 };
const LANDSCAPE = { width: 844, height: 390 };

async function noHorizontalOverflow(page: Page, where: string): Promise<void> {
  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW, `${where}에서 가로 넘침`).toBeLessThanOrEqual(clientW);
}

test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

test('세로 화면: 로비·저잣거리·대국이 가로로 넘치지 않는다', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await page.fill('#nickname', '폰');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByRole('button', { name: '빠른 대전' })).toBeVisible();
  await noHorizontalOverflow(page, '로비');

  await page.getByRole('button', { name: '저잣거리' }).click();
  await expect(page.getByText('파는 것은 전부 치레거리입니다')).toBeVisible();
  await noHorizontalOverflow(page, '저잣거리');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '연습 대국' }).click();
  await expect(page.locator('[data-board]').first()).toBeVisible({ timeout: 20_000 });
  await noHorizontalOverflow(page, '대국');

  // 손패 14장이 전부 화면 안에 들어온다
  const tiles = page.locator('[data-board]').first();
  await expect(tiles).toBeVisible();
  const handRight = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[role="button"][aria-label]')];
    return Math.max(0, ...els.map((e) => e.getBoundingClientRect().right));
  });
  expect(handRight, '손패가 화면 밖으로 나감').toBeLessThanOrEqual(PHONE.width + 1);

  // 눕혀도 / 더 좁아도 넘치지 않는다
  await page.setViewportSize(LANDSCAPE);
  await page.waitForTimeout(300);
  await noHorizontalOverflow(page, '가로 화면');

  await page.setViewportSize(SMALL);
  await page.waitForTimeout(300);
  await noHorizontalOverflow(page, '320px 화면');

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('세로 화면: 설정 서랍으로 사이드 패널에 닿는다', async ({ page }) => {
  await page.goto('/');
  await page.fill('#nickname', '서랍');
  await page.getByRole('button', { name: '입장' }).click();
  await page.getByRole('button', { name: '연습 대국' }).click();
  await expect(page.locator('[data-board]').first()).toBeVisible({ timeout: 20_000 });

  // 좁은 화면에서는 사이드 패널이 접혀 있다
  const drawer = page.getByRole('dialog', { name: '설정' });
  await expect(drawer).toHaveCount(0);

  await page.getByRole('button', { name: '설정' }).click();
  await expect(drawer.getByText('자동 화료')).toBeVisible();
  await noHorizontalOverflow(page, '설정 서랍');

  await drawer.getByRole('button', { name: '역 일람' }).click();
  await expect(drawer.getByPlaceholder('역 검색')).toBeVisible();

  await drawer.getByText('닫기', { exact: true }).click();
  await expect(drawer).toHaveCount(0);
});

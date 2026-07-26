import { expect, test } from '@playwright/test';

/**
 * 정식 계정 (PLAN.md §3.1).
 *
 * 확인하는 것:
 *  1) 게스트로 모은 엽전이 가입 뒤에도 그대로 남는다 (승격)
 *  2) 복구 코드는 가입 직후 한 번만 보이고, 그 전에는 창을 닫을 수 없다
 *  3) 로그아웃하면 토큰이 지워지고 첫 화면으로 돌아간다
 *  4) 다른 브라우저 컨텍스트에서 아이디·비밀번호로 같은 계정에 들어간다
 */

const PASSWORD = 'giwa-1234';

/** 잔액바(엽전 아이콘이 붙은 칩)의 숫자 */
async function purse(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find((e) =>
      e.querySelector('img[src*="yeopjeon"]'),
    );
    return el?.textContent?.trim() ?? '';
  });
}

test('게스트 → 가입(승격) → 로그아웃 → 다른 기기 로그인', async ({ page, browser }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // 1) 게스트 입장 — 빈곤 구제로 엽전이 들어온다
  await page.goto('/');
  await page.getByRole('button', { name: '게스트' }).click();
  await page.fill('#nickname', '나그네');
  await page.getByRole('button', { name: '입장', exact: true }).click();
  await expect(page.getByRole('button', { name: '빠른 대전' })).toBeVisible();
  await expect(page.getByText('게스트', { exact: true })).toBeVisible();
  const before = await purse(page);
  expect(before).not.toBe('');

  // 2) 이름표 → 계정 창 → 가입
  await page.locator('button:has-text("나그네")').first().click();
  await expect(page.getByText('지금 계정을 만들면')).toBeVisible();
  await page.fill('#acc-loginId', 'nageune');
  await page.fill('#acc-password', PASSWORD);
  await page.fill('#acc-again', PASSWORD);
  await page.getByRole('button', { name: '계정 만들기' }).last().click();

  // 3) 복구 코드가 뜨고, 확인하기 전에는 닫기 버튼이 없다
  await expect(page.getByText('복구 코드')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: '닫기' })).toHaveCount(0);
  const code = (await page.locator('.select-all').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  await page.getByRole('button', { name: '적어 뒀습니다' }).click();

  // 4) 계정이 붙었고 엽전은 그대로다
  await expect(page.getByText('nageune')).toBeVisible();
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('게스트', { exact: true })).toHaveCount(0);
  expect(await purse(page)).toBe(before);

  // 5) 다른 기기(별도 컨텍스트)에서 아이디·비밀번호로 들어와도 같은 지갑이다
  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: '로그인' }).click();
  await other.fill('#loginId', 'NaGeuNe'); // 대소문자를 가리지 않는다
  await other.fill('#password', 'wrong-password');
  await other.getByRole('button', { name: '로그인', exact: true }).last().click();
  await expect(other.getByRole('alert').first()).toContainText('올바르지 않습니다');

  // 서버가 인증 요청 사이에 최소 간격을 둔다 (자동 연타 차단) — 사람 속도보다 훨씬 짧다
  await other.waitForTimeout(300);
  await other.fill('#password', PASSWORD);
  await other.getByRole('button', { name: '로그인', exact: true }).last().click();
  await expect(other.getByRole('button', { name: '빠른 대전' })).toBeVisible({ timeout: 15_000 });
  expect(await purse(other)).toBe(before);
  await otherCtx.close();

  // 6) 로그아웃 → 첫 화면 + 토큰 제거
  await page.locator('button:has-text("나그네")').first().click();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByText('한국 전통 온라인 리치마작')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cheongiwa.token'))).toBeNull();

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('같은 아이디로는 두 번 가입할 수 없다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '가입' }).click();
  await page.fill('#loginId', 'dupetest');
  await page.fill('#nickname', '첫사람');
  await page.fill('#password', PASSWORD);
  await page.fill('#passwordAgain', PASSWORD);
  await page.getByRole('button', { name: '가입하고 시작' }).click();
  await expect(page.getByText('복구 코드')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '적어 뒀습니다' }).click();
  await page.getByRole('button', { name: '닫기' }).click();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '가입' }).click();
  await page.fill('#loginId', 'dupetest');
  await page.fill('#nickname', '둘째');
  await page.fill('#password', PASSWORD);
  await page.fill('#passwordAgain', PASSWORD);
  await page.getByRole('button', { name: '가입하고 시작' }).click();
  await expect(page.getByRole('alert').first()).toContainText('이미 쓰는 아이디');
});

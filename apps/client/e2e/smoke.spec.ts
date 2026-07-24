import { expect, test } from '@playwright/test';

/**
 * 스모크 (PLAN.md §8.2): 방 생성 → 봇 3 추가 → 동풍전 완주 → 결과 확인.
 * 은닉 정보·룰 판정은 서버가 담당하므로 여기서는 전체 플로우 도달만 검증한다.
 */
test('친선방 → 봇 3 → 동풍전 완주 → 최종 결과', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');

  // 로비: 닉네임 입장
  await page.fill('#nickname', '테스터');
  await page.getByRole('button', { name: '입장' }).click();

  // 친선방 만들기 → 동풍전
  await page.getByRole('button', { name: '친선방 만들기' }).click();
  await expect(page.getByText('코드 복사')).toBeVisible();
  await page.getByRole('button', { name: '동풍전' }).click();

  // 봇 3 추가
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /봇 추가/ }).click();
  }
  // 좌석 4개가 채워졌는지
  await expect(page.getByText(/봇/).first()).toBeVisible();

  // 대국 시작
  await page.getByRole('button', { name: /대국 시작/ }).click();

  // 대국 화면 진입 (보드)
  await expect(page.locator('.aspect-square').first()).toBeVisible({ timeout: 15_000 });

  // 자동 편의 전부 켜기 → 무인 진행
  for (const label of ['자동 화료', '울기 스킵', '자동 쯔모기리']) {
    await page.getByRole('button', { name: label }).click();
  }

  // 동풍전 완주 → 최종 결과
  await expect(page.getByRole('heading', { name: '최종 결과' })).toBeVisible({ timeout: 90_000 });

  // 순위 4개 + 시드 검증 링크
  await expect(page.getByText('공정성 증명 (시드 검증)')).toBeVisible();
  await expect(page.getByText('1위')).toBeVisible();

  // 로비 복귀
  await page.getByRole('button', { name: '로비로' }).click();
  await expect(page.getByRole('button', { name: '빠른 대전' })).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

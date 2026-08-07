# 배포 체크리스트

## 지금 이미 되어 있는 것 (자동으로 완료됨)

- `~/.config/systemd/user/fab-dashboard-web.service`, `fab-dashboard-gds.service` 설치 + `enable --now` 완료
  - 웹앱: `http://<이 서버의 LAN IP>:8001` (예: `http://192.168.0.18:8001`)
  - GDS 사이드카: `127.0.0.1:8003` (내부 전용, 외부 노출 안 됨)
- crontab 등록 완료:
  - 3시간마다 노트 변경 감지 + 추출 (`packages/ingestion/src/run-update.ts`)
  - 매시간 이월 경계 체크 (`packages/ingestion/src/run-cutover-check.ts`)
- 로그 위치: `logs/web.log`, `logs/gds-analyzer.log`, `logs/ingestion.log`, `logs/cutover.log`

## 서비스 확인/재시작 명령

```bash
systemctl --user status fab-dashboard-web.service fab-dashboard-gds.service
systemctl --user restart fab-dashboard-web.service
journalctl --user -u fab-dashboard-web.service -f   # 실시간 로그
```

## 선택 사항 — 로그아웃/재부팅 후에도 서비스 유지 (sudo 필요)

지금은 `Linger=no` 상태라 이 계정에서 완전히 로그아웃하면 위 서비스들이 같이 종료됩니다. 서버를 재부팅하거나 로그아웃 후에도 계속 떠 있어야 한다면:

```bash
sudo loginctl enable-linger <username>
```

## 나중에 — 외부 공개 (사용자가 Route53 등으로 도메인 준비되면, sudo 필요)

1. `deploy/nginx/fab-dashboard.conf`의 `<subdomain>`을 실제 도메인으로 바꾸기
2. ```bash
   sudo cp deploy/nginx/fab-dashboard.conf /etc/nginx/sites-available/fab-dashboard.conf
   sudo ln -s /etc/nginx/sites-available/fab-dashboard.conf /etc/nginx/sites-enabled/
   sudo certbot --nginx -d <subdomain>   # 기존 www.yourdomain.example.conf와 동일한 패턴
   sudo systemctl reload nginx
   ```
3. 방화벽에서 80/443 포트가 막혀있다면 오픈 필요 (기존 nginx 도메인들이 이미 열려있는 걸로 보아 아마 불필요)

## 인증 정보 (분실 시)

`apps/web/.env.local`의 `VIEWER_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH`를 재생성하려면:

```bash
npx tsx scripts/hash-password.ts '<새 비밀번호>'
```

나온 해시를 `.env.local`에 넣을 때 **`$` 문자를 전부 `\$`로 escape**해야 합니다 (Next.js가 `.env` 파일에서 `$VAR`를 변수 참조로 해석하기 때문 — 이걸 놓치면 로그인이 조용히 실패합니다).

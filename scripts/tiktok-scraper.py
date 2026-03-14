#!/usr/bin/env python3
"""
TikTok Creator Center 스크래퍼 — uiautomator2 기반
sns_common.py의 EmulatorManager 재사용

출력: JSON { posts: [...], account: {...} }
"""

import json
import sys
import time
import re

try:
    import uiautomator2 as u2
except ImportError:
    print(json.dumps({"error": "uiautomator2가 설치되지 않았습니다. pip install uiautomator2"}), file=sys.stderr)
    sys.exit(1)

try:
    from sns_common import EmulatorManager, human_delay, DELAY_SHORT, DELAY_MEDIUM, DELAY_LONG
except ImportError:
    print(json.dumps({"error": "sns_common.py를 찾을 수 없습니다. PYTHONPATH를 확인하세요."}), file=sys.stderr)
    sys.exit(1)


def parse_count(text):
    """'1.2K', '3.4M', '567' 등을 숫자로 변환"""
    if not text:
        return 0
    text = text.strip().replace(',', '')
    multipliers = {'K': 1000, 'M': 1000000, 'B': 1000000000}
    for suffix, mult in multipliers.items():
        if text.upper().endswith(suffix):
            try:
                return int(float(text[:-1]) * mult)
            except ValueError:
                return 0
    try:
        return int(text)
    except ValueError:
        return 0


def scrape_creator_center(d):
    """TikTok Creator Center에서 데이터 스크래핑"""
    result = {"posts": [], "account": {}}

    # TikTok 앱 실행
    d.app_start("com.zhiliaoapp.musically")
    human_delay(DELAY_LONG)

    # 프로필 탭으로 이동
    profile_btn = d(resourceId="com.zhiliaoapp.musically:id/eb5") or d(description="Profile")
    if profile_btn.exists(timeout=5):
        profile_btn.click()
        human_delay(DELAY_MEDIUM)

    # 팔로워/팔로잉 수 수집
    try:
        followers_el = d(resourceId="com.zhiliaoapp.musically:id/biy")
        if followers_el.exists(timeout=3):
            result["account"]["followers"] = parse_count(followers_el.get_text())

        following_el = d(resourceId="com.zhiliaoapp.musically:id/biw")
        if following_el.exists(timeout=3):
            result["account"]["following"] = parse_count(following_el.get_text())
    except Exception:
        pass

    # Creator Center / Analytics로 이동
    # 메뉴 버튼 → Creator tools → Analytics
    menu_btn = d(description="More options") or d(resourceId="com.zhiliaoapp.musically:id/d74")
    if menu_btn.exists(timeout=5):
        menu_btn.click()
        human_delay(DELAY_SHORT)

    creator_tools = d(text="Creator tools") or d(textContains="Creator")
    if creator_tools.exists(timeout=5):
        creator_tools.click()
        human_delay(DELAY_MEDIUM)

    analytics_btn = d(text="Analytics") or d(textContains="Analytics")
    if analytics_btn.exists(timeout=5):
        analytics_btn.click()
        human_delay(DELAY_LONG)

    # Overview 탭에서 총 조회수 수집
    try:
        views_el = d(textContains="Video views")
        if views_el.exists(timeout=3):
            # 근처 숫자 요소 찾기
            parent = views_el.parent()
            if parent:
                nums = parent.child(className="android.widget.TextView")
                for n in nums:
                    txt = n.get_text()
                    if txt and any(c.isdigit() for c in txt):
                        result["account"]["views"] = parse_count(txt)
                        break
    except Exception:
        pass

    # Content 탭으로 이동하여 개별 포스트 수집
    content_tab = d(text="Content") or d(textContains="Content")
    if content_tab.exists(timeout=5):
        content_tab.click()
        human_delay(DELAY_MEDIUM)

    # 포스트 목록 스크래핑 (최대 20개)
    post_items = d(className="android.view.ViewGroup", clickable=True)
    collected_ids = set()

    for scroll_round in range(3):
        for item in post_items:
            try:
                # 포스트 클릭하여 상세 보기
                item.click()
                human_delay(DELAY_MEDIUM)

                post_data = {"id": "", "caption": "", "views": 0, "likes": 0, "comments": 0, "shares": 0}

                # 조회수
                views_text = d(resourceId="com.zhiliaoapp.musically:id/title")
                if views_text.exists(timeout=2):
                    post_data["views"] = parse_count(views_text.get_text())

                # 좋아요
                likes_text = d(resourceId="com.zhiliaoapp.musically:id/dz6")
                if likes_text.exists(timeout=2):
                    post_data["likes"] = parse_count(likes_text.get_text())

                # 댓글
                comments_text = d(resourceId="com.zhiliaoapp.musically:id/dz8")
                if comments_text.exists(timeout=2):
                    post_data["comments"] = parse_count(comments_text.get_text())

                # 공유
                shares_text = d(resourceId="com.zhiliaoapp.musically:id/dz9")
                if shares_text.exists(timeout=2):
                    post_data["shares"] = parse_count(shares_text.get_text())

                # 캡션
                caption_el = d(resourceId="com.zhiliaoapp.musically:id/desc")
                if caption_el.exists(timeout=2):
                    post_data["caption"] = caption_el.get_text() or ""
                    post_data["hashtags"] = re.findall(r'#[\w\uAC00-\uD7A3]+', post_data["caption"])

                # 고유 ID 생성 (캡션 + 조회수 기반)
                post_id = f"tt_{hash(post_data['caption'][:50]) & 0xFFFFFFFF}"
                post_data["id"] = post_id

                if post_id not in collected_ids:
                    collected_ids.add(post_id)
                    result["posts"].append(post_data)

                # 뒤로가기
                d.press("back")
                human_delay(DELAY_SHORT)

            except Exception:
                d.press("back")
                human_delay(DELAY_SHORT)
                continue

        if len(result["posts"]) >= 20:
            break

        # 스크롤 다운
        d.swipe(0.5, 0.8, 0.5, 0.3, duration=0.5)
        human_delay(DELAY_SHORT)

    # TikTok 앱 종료
    d.app_stop("com.zhiliaoapp.musically")

    return result


def main():
    emu = EmulatorManager()

    try:
        if not emu.is_running():
            print(json.dumps({"error": "에뮬레이터가 실행 중이 아닙니다. 먼저 에뮬레이터를 시작하세요."}))
            sys.exit(1)

        d = u2.connect()
        result = scrape_creator_center(d)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

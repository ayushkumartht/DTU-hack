#!/usr/bin/env python3
"""
Swami Vivekananda Quotes Scraper
Source: https://media.belurmath.org/tag/quotations/

Scrapes Swami Vivekananda quotes from the Belur Math media gallery,
processes HTML content into clean text, and saves structured results as JSON and CSV.
"""

import os
import sys
import json
import csv
import html
import re
import argparse
import urllib.request
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

# Target URLs and Parameters
BASE_TAG_URL = "https://media.belurmath.org/tag/quotations/"
WP_API_URL = "https://media.belurmath.org/wp-json/wp/v2/posts"
TAG_ID = 390  # Tag ID for 'quotations' on Belur Math WP site


class HTMLCleaner(HTMLParser):
    """Simple HTML parser to extract clean text content from HTML markup."""
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ''.join(self.fed)


def clean_html(raw_html: str) -> str:
    """Converts HTML text to clean, plain text with normalized whitespace."""
    if not raw_html:
        return ""
    # Remove HTML tags using HTMLParser
    parser = HTMLCleaner()
    parser.feed(raw_html)
    text = parser.get_data()
    # Unescape HTML entities (e.g. &nbsp;, &amp;, &quot;)
    text = html.unescape(text)
    # Normalize multiple whitespace and newlines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = ' '.join(lines)
    return cleaned


def fetch_json(url: str, user_agent: str = "Mozilla/5.0") -> tuple:
    """Fetches JSON data from URL with headers."""
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            headers = response.headers
            return data, headers
    except HTTPError as e:
        if e.code == 400:
            # End of pagination reached
            return None, None
        print(f"HTTP Error {e.code}: {e.reason} for URL: {url}", file=sys.stderr)
        return None, None
    except URLError as e:
        print(f"URL Error: {e.reason} for URL: {url}", file=sys.stderr)
        return None, None
    except Exception as e:
        print(f"Unexpected error fetching {url}: {e}", file=sys.stderr)
        return None, None


def scrape_quotes(max_pages: int = 50) -> list:
    """
    Scrapes all Swami Vivekananda quotes from Belur Math.
    Returns a list of dictionary objects representing quotes.
    """
    print(f"Scraping quotes from Belur Math ({BASE_TAG_URL})...")
    quotes = []
    page = 1
    per_page = 100

    while page <= max_pages:
        api_url = f"{WP_API_URL}?tags={TAG_ID}&per_page={per_page}&page={page}"
        print(f"Fetching page {page} via WP REST API...", end=" ", flush=True)

        posts, headers = fetch_json(api_url)
        if not posts:
            print("[Done / End of pages]")
            break

        print(f"received {len(posts)} posts.")

        for post in posts:
            title_raw = post.get("title", {}).get("rendered", "")
            title = html.unescape(title_raw).strip()
            content_raw = post.get("content", {}).get("rendered", "")
            content_clean = clean_html(content_raw)
            link = post.get("link", "")
            date = post.get("date", "")
            post_id = post.get("id")

            # Check if post pertains to Swami Vivekananda
            is_vivekananda = (
                "vivekananda" in title.lower() or
                "vivekananda" in content_clean.lower()
            )

            if is_vivekananda:
                # Extract image URL if present in jetpack_featured_media_url or content
                image_url = post.get("jetpack_featured_media_url", "")
                if not image_url:
                    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_raw)
                    if img_match:
                        image_url = img_match.group(1)

                quotes.append({
                    "id": post_id,
                    "title": title,
                    "author": "Swami Vivekananda",
                    "quote": content_clean,
                    "link": link,
                    "image_url": image_url,
                    "date": date,
                    "raw_html": content_raw
                })

        page += 1

    return quotes


def save_quotes(quotes: list, output_json: str, output_csv: str):
    """Saves quotes list into JSON and CSV files."""
    # Ensure directory exists
    json_dir = os.path.dirname(output_json)
    if json_dir and not os.path.exists(json_dir):
        os.makedirs(json_dir, exist_ok=True)

    csv_dir = os.path.dirname(output_csv)
    if csv_dir and not os.path.exists(csv_dir):
        os.makedirs(csv_dir, exist_ok=True)

    # Save JSON
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(quotes, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(quotes)} quotes to JSON: {output_json}")

    # Save CSV
    if quotes:
        fieldnames = ["id", "title", "author", "quote", "link", "image_url", "date"]
        with open(output_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(quotes)
        print(f"Saved {len(quotes)} quotes to CSV: {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="Scrape Swami Vivekananda quotes from Belur Math.")
    parser.add_argument("--output-json", default="data/vivekananda_quotes.json", help="Path for JSON output file.")
    parser.add_argument("--output-csv", default="data/vivekananda_quotes.csv", help="Path for CSV output file.")
    parser.add_argument("--max-pages", type=int, default=50, help="Maximum number of pages to scrape.")
    args = parser.parse_args()

    quotes = scrape_quotes(max_pages=args.max_pages)

    print("\n" + "=" * 60)
    print(f"Scraping Completed: Total Swami Vivekananda Quotes Found = {len(quotes)}")
    print("=" * 60)

    if quotes:
        print("\nSample Quotes:")
        for idx, q in enumerate(quotes[:3], 1):
            print(f"\n[{idx}] {q['title']}")
            print(f"    Link:  {q['link']}")
            print(f"    Quote: {q['quote'][:120]}...")

    save_quotes(quotes, args.output_json, args.output_csv)


if __name__ == "__main__":
    main()

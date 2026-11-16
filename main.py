

import sys
import os
import pymupdf

from stats import (
    get_num_words,
    get_character_count,
    chars_dict_to_sorted_list,
    get_unused_letters
)


def get_book_text(path):
    extension = os.path.splitext(path)[1].lower()

    if extension == ".pdf":
        document = pymupdf.open(path)
        file_contents = ""

        for page in document:
            file_contents += page.get_text()

        document.close()
        return file_contents

    elif extension == ".txt":
        with open(path, encoding="utf-8") as f:
            return f.read()

    else:
        raise ValueError("Only TXT and PDF files are supported.")


def print_report(book_path, num_words, sorted_chars, unused_letters):
    print("============ BOOKBOT ============")
    print(f"Analyzing file: {book_path}")

    print("----------- Word Count ----------")
    print(f"Found {num_words} total words")

    print("--------- Character Count -------")

    for char, count in sorted_chars:
        if not char.isalpha():
            continue

        print(f"{char}: {count}")

    print("--------- Unused Letters --------")
    print(", ".join(unused_letters))

    print("============= END ===============")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 main.py <path_to_file>")
        sys.exit(1)

    book_path = sys.argv[1]

    try:
        book_text = get_book_text(book_path)

    except FileNotFoundError:
        print(f"Error: File not found: {book_path}")
        sys.exit(1)

    except ValueError as error:
        print(f"Error: {error}")
        sys.exit(1)

    num_words = get_num_words(book_text)

    char_count = get_character_count(book_text)

    sorted_chars = chars_dict_to_sorted_list(char_count)

    unused_letters = get_unused_letters(char_count)

    print_report(
        book_path,
        num_words,
        sorted_chars,
        unused_letters
    )


main()

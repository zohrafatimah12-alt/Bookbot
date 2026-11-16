

def get_num_words(text):
    words = text.split()
    return len(words)


def get_character_count(text):
    char_count = {}
    lowercase_text = text.lower()

    for char in lowercase_text:
        if char in char_count:
            char_count[char] += 1
        else:
            char_count[char] = 1

    return char_count


def sort_on(item):
    return item[1]


def chars_dict_to_sorted_list(char_dict):
    sorted_list = []

    for char in char_dict:
        count = char_dict[char]
        sorted_list.append((char, count))

    sorted_list = sorted(
        sorted_list,
        reverse=True,
        key=sort_on
    )

    return sorted_list


def get_unused_letters(char_count):
    unused_letters = []
    alphabet = "abcdefghijklmnopqrstuvwxyz"

    for letter in alphabet:
        if letter not in char_count:
            unused_letters.append(letter)

    return unused_letters

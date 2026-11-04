import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Search box that keeps its own text.
 *
 * The text used to live in the screen's state, so every keystroke re-rendered
 * the whole screen — on Home that meant the product grid, three horizontal
 * rails, the category chips and the filter row, all while the user was typing.
 * Holding the text here means the screen only re-renders when the DEBOUNCED
 * query changes, which it has to anyway to fetch results.
 *
 * `onSearch` fires after the user stops typing (or immediately on clear).
 */
export function SearchField({
  onSearch,
  placeholder,
  debounceMs = 400,
  style,
  inputStyle,
  iconColor = '#0F3D2E',
  placeholderTextColor = '#9aa0a6',
}: {
  onSearch: (q: string) => void;
  placeholder?: string;
  debounceMs?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  placeholderTextColor?: string;
}) {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the newest callback without making it a dependency of the debounce.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const change = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchRef.current(next), debounceMs);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setText('');
    onSearchRef.current('');          // clearing is immediate — nothing to wait for
  };

  return (
    <View style={style}>
      <Ionicons name="search" size={20} color={iconColor} />
      <TextInput
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        value={text}
        onChangeText={change}
        returnKeyType="search"
        autoCorrect={false}
      />
      {text.length > 0 && (
        <TouchableOpacity onPress={clear} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={placeholderTextColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default SearchField;

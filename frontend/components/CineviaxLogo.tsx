import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const logo = require('../../media/Cineviax_logo.png');

export default function CineviaxLogo({ size = 80 }: { size?: number }) {
  return (
    <View style={styles.container}>
      <Image source={logo} style={[styles.logo, { width: size, height: size }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
  },
});

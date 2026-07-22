import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  FlatList,
  FlatListProps,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CustomBottomSheetRef {
  snapToIndex: (index: number) => void;
  close: () => void;
}

interface CustomBottomSheetProps {
  /** Array of snap points as percentages, e.g. ['40%', '75%', '95%'] */
  snapPoints: string[];
  /** Initial snap index (default 0) */
  initialIndex?: number;
  /** Called when the active snap index changes */
  onChange?: (index: number) => void;
  /** Backdrop component - if not provided, default dimming backdrop is used */
  backdropComponent?: React.FC<{ progress: Animated.Value; onPress: () => void }> | null;
  /** Handle indicator style */
  handleIndicatorStyle?: object;
  /** Handle container style */
  handleStyle?: object;
  /** Background style of the sheet */
  backgroundStyle?: object;
  /** Children to render inside the sheet */
  children: React.ReactNode;
}

/**
 * Custom bottom sheet using only React Native Animated + PanResponder.
 * Drop-in replacement for @gorhom/bottom-sheet for Expo Go compatibility.
 *
 * Supports: snap points, swipe gesture, backdrop, keyboard avoidance.
 */
const CustomBottomSheet = forwardRef<CustomBottomSheetRef, CustomBottomSheetProps>(
  (
    {
      snapPoints,
      initialIndex = 0,
      onChange,
      backdropComponent,
      handleIndicatorStyle,
      handleStyle,
      backgroundStyle,
      children,
    },
    ref
  ) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const currentIndexRef = useRef(initialIndex);
    const isOpenRef = useRef(false);

    // Parse snap points to pixel values (from bottom)
    const snapPixels = snapPoints.map((sp) => {
      const pct = parseFloat(sp) / 100;
      return SCREEN_HEIGHT * (1 - pct);
    });

    // Snap to a given index
    const snapToIndex = useCallback(
      (index: number) => {
        if (index < 0 || index >= snapPixels.length) return;
        Keyboard.dismiss();
        currentIndexRef.current = index;
        isOpenRef.current = true;
        const destY = snapPixels[index];
        const backdropDest = 1 - destY / SCREEN_HEIGHT;

        Animated.parallel([
          Animated.spring(translateY, {
            toValue: destY,
            useNativeDriver: false,
            damping: 20,
            stiffness: 200,
          }),
          Animated.timing(backdropOpacity, {
            toValue: backdropDest,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => {
          onChange?.(index);
        });
      },
      [snapPixels, translateY, backdropOpacity, onChange]
    );

    const close = useCallback(() => {
      isOpenRef.current = false;
      currentIndexRef.current = -1;
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }, [translateY, backdropOpacity]);

    // Expose snapToIndex and close via ref
    useImperativeHandle(ref, () => ({
      snapToIndex,
      close,
    }));

    // Initial animation — open to initialIndex on mount
    useEffect(() => {
      // Start hidden, then animate to initial index
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      const timer = setTimeout(() => {
        snapToIndex(initialIndex);
      }, 50);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Find closest snap point to current Y
    const findClosestSnap = (y: number): number => {
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < snapPixels.length; i++) {
        const dist = Math.abs(y - snapPixels[i]);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      return closest;
    };

    // PanResponder for drag gesture
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 5;
        },
        onPanResponderGrant: () => {
          // Stop any running animation and capture current value
          translateY.stopAnimation((value) => {
            translateY.setOffset(value);
            translateY.setValue(0);
          });
        },
        onPanResponderMove: (_, gestureState) => {
          // Clamp: don't let drag above the highest snap point
          const minY = snapPixels[snapPixels.length - 1];
          const rawValue = gestureState.dy;
          const offsetValue = (translateY as any)._offset ?? 0;
          const newValue = offsetValue + rawValue;
          // Allow drag down past lowest snap (to dismiss)
          // But prevent drag above highest snap
          if (newValue < minY) {
            translateY.setValue(minY - offsetValue);
          } else {
            translateY.setValue(rawValue);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          translateY.flattenOffset();
          const value = (translateY as any)._value ?? 0;
          const velocity = gestureState.vy;
            let targetY = value;

            // If swiping down fast → close or go to lower snap
            if (velocity > 0.5 || gestureState.dy > 80) {
              const closestBelow = findClosestSnap(value);
              if (value > snapPixels[0] + 40) {
                // Past the first snap → close
                close();
                return;
              }
              targetY = snapPixels[Math.max(0, closestBelow - 1)] ?? snapPixels[0];
            }
            // If swiping up fast → go to higher snap
            else if (velocity < -0.5 || gestureState.dy < -80) {
              const closest = findClosestSnap(value);
              targetY = snapPixels[Math.min(snapPixels.length - 1, closest + 1)] ?? snapPixels[snapPixels.length - 1];
            }
            // No strong velocity → snap to closest
            else {
              const closest = findClosestSnap(value);
              targetY = snapPixels[closest];
            }

            // Animate to target
            const newIdx = findClosestSnap(targetY);
            currentIndexRef.current = newIdx;
            const backdropDest = 1 - targetY / SCREEN_HEIGHT;

            Animated.parallel([
              Animated.spring(translateY, {
                toValue: targetY,
                useNativeDriver: false,
                damping: 20,
                stiffness: 200,
              }),
              Animated.timing(backdropOpacity, {
                toValue: backdropDest,
                duration: 200,
                useNativeDriver: false,
              }),
            ]).start(() => {
              onChange?.(newIdx);
            });
        },
      })
    ).current;

    // Default backdrop
    const DefaultBackdrop: React.FC<{ progress: Animated.Value; onPress: () => void }> = ({
      progress,
      onPress,
    }) => (
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: progress, backgroundColor: '#000' },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          onPress={onPress}
          activeOpacity={1}
        />
      </Animated.View>
    );

    const BackdropComp = backdropComponent ?? DefaultBackdrop;

    return (
      <>
        {/* Backdrop */}
        <BackdropComp progress={backdropOpacity} onPress={close} />

        {/* Sheet Panel */}
        <Animated.View
          style={[
            styles.sheet,
            backgroundStyle,
            {
              transform: [{ translateY }],
              height: SCREEN_HEIGHT,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle area */}
          <View style={[styles.handleArea, handleStyle]}>
            <View style={[styles.indicator, handleIndicatorStyle]} />
          </View>

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';

export default CustomBottomSheet;

/**
 * Drop-in replacement for BottomSheetFlatList.
 * Just a regular FlatList styled to work inside the sheet.
 */
export const SheetFlatList = FlatList as unknown as React.FC<FlatListProps<any>>;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 101,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  indicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  content: {
    flex: 1,
  },
});

#ifndef ML_MODEL_H
#define ML_MODEL_H

// NeuroSync Edge AI - MCU TinyML Decision Tree
// Trained on 1,000,000 industrial data points

int predict_risk(float vib, float temp, float gas, float corr) {
  if (gas <= 1499.996) {
    if (temp <= 60.000) {
      if (corr <= 0.500) {
        if (vib <= 3.000) {
          return 0;
        } else {
          return 1;
        }
      } else {
        if (vib <= 3.000) {
          return 1;
        } else {
          return 2;
        }
      }
    } else {
      if (vib <= 3.000) {
        if (corr <= 0.500) {
          return 1;
        } else {
          return 2;
        }
      } else {
        return 2;
      }
    }
  } else {
    if (vib <= 3.000) {
      if (temp <= 59.998) {
        if (corr <= 0.500) {
          return 1;
        } else {
          return 2;
        }
      } else {
        if (temp <= 60.000) {
          return 2;
        } else {
          return 2;
        }
      }
    } else {
      return 2;
    }
  }
}

#endif

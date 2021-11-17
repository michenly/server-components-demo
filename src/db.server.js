/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// Todo: figure out if there are webpack config way I can import from `react-pg` instead
import {Pool} from 'react-pg/index.node.server';
import credentials from '../credentials';

// Don't keep credentials in the source tree in a real app!
export const db = new Pool(credentials);
